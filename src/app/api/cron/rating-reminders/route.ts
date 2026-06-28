import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { db } from "@/lib/db";
import {
  maybeSendRatingRequest,
  RATING_REMINDER_INTERVAL_DAYS,
  RATING_REMINDER_MAX,
} from "@/lib/email/rating-request";

const cronRatingRemindersLogger = logger.child({ module: "cron-rating-reminders" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Automated rating-reminder cron.
//
// Sends the "rate your creator" nudge to fulfilled backers who haven't left
// a star rating, and KEEPS re-sending weekly (up to RATING_REMINDER_MAX)
// until they do — so a review request persists until the review is
// submitted. maybeSendRatingRequest is the source of truth for the
// per-pledge cadence/cap and stamps ratingReminderCount/ratingRequestSentAt;
// this just feeds it the due candidates, throttled per run.
//
// Crontab (localhost so a DNS blip can't kill it):
//   0 16 * * * . /root/indiecrowdfund_2.0/.env && \
//     curl -s -H "Authorization: Bearer $CRON_SECRET" \
//     http://localhost:3000/api/cron/rating-reminders > /dev/null 2>&1

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dueBefore = new Date(
      Date.now() - RATING_REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000
    );
    // Cap how many we touch per run so we never blast the whole backlog
    // (and the email provider) in one tick — the weekly cadence means the
    // rest get picked up on subsequent days.
    const limit = 300;

    const candidates = await db.pledge.findMany({
      where: {
        status: "COMPLETED",
        deletedAt: null,
        // Reward is in the backer's hands (shipped or delivered).
        fulfillmentStatus: { in: ["SHIPPED", "DELIVERED"] },
        // Hasn't reviewed, under the reminder cap, and due for a nudge.
        reviewSubmittedAt: null,
        ratingReminderCount: { lt: RATING_REMINDER_MAX },
        OR: [
          { ratingRequestSentAt: null },
          { ratingRequestSentAt: { lt: dueBefore } },
        ],
        // Safety net for un-backfilled history.
        NOT: { review: { is: { overallRating: { not: null } } } },
        user: { is: { emailUnsubscribedAt: null, deletedAt: null } },
      },
      select: { id: true },
      // Never-nudged first, then the longest-waiting.
      orderBy: { ratingRequestSentAt: { sort: "asc", nulls: "first" } },
      take: limit,
    });

    let sent = 0;
    let skipped = 0;
    for (const p of candidates) {
      const result = await maybeSendRatingRequest(p.id);
      if (result.sent) sent += 1;
      else skipped += 1;
    }

    cronRatingRemindersLogger.info(
      { scanned: candidates.length, sent, skipped },
      "Rating-reminder cron complete"
    );
    return NextResponse.json({ ok: true, scanned: candidates.length, sent, skipped });
  } catch (error) {
    cronRatingRemindersLogger.error({ err: formatError(error) }, "Rating-reminder cron failed");
    return NextResponse.json({ error: "Rating reminder cron failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
