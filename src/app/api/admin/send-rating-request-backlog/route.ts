import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { maybeSendRatingRequest } from "@/lib/email/rating-request";

const backlogLogger = logger.child({ module: "admin-rating-request-backlog" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/admin/send-rating-request-backlog
//
// One-time (re-runnable) batch send of the "rate your creator" nudge
// to already-fulfilled backers who never rated. Idempotent: every
// send goes through maybeSendRatingRequest, which stamps
// ratingRequestSentAt, so re-running only picks up pledges that
// haven't been emailed yet.
//
// Auth: SUPER_ADMIN
//
// Body (all optional):
//   {
//     dryRun?: boolean,        // default false — preview counts only
//     deliveredOnly?: boolean, // default true — only FULFILLED pledges
//                              //   (SHIPPED or DELIVERED). set false to
//                              //   include every COMPLETED pledge
//                              //   regardless of fulfillment.
//     limit?: number,          // default 200, max 1000 per run —
//                              //   throttle so we don't blast the
//                              //   whole backlog + the email provider
//                              //   in one shot
//     projectId?: string       // optional: scope to one campaign
//   }
//
// Recommended usage: run with a modest limit (e.g. 100-200) repeatedly
// over a few days rather than one giant blast — keeps deliverability
// healthy and spreads the inbound rating traffic.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { dryRun?: boolean; deliveredOnly?: boolean; limit?: number; projectId?: string } = {};
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
  } catch {}

  const dryRun = body.dryRun === true;
  const deliveredOnly = body.deliveredOnly !== false; // default true
  const limit = Math.max(1, Math.min(1000, body.limit ?? 200));

  try {
    // Candidate pledges: COMPLETED, not soft-deleted, no rating-request
    // email sent yet, and the backer hasn't left a star rating. We
    // can't filter "no overallRating" directly in the Pledge query
    // (it's on BackerReview) so we exclude pledges that already have a
    // review row WITH an overallRating via a NOT-relation filter.
    const candidates = await db.pledge.findMany({
      where: {
        status: "COMPLETED",
        deletedAt: null,
        ratingRequestSentAt: null,
        ...(deliveredOnly ? { fulfillmentStatus: { in: ["SHIPPED", "DELIVERED"] } } : {}),
        ...(body.projectId ? { projectId: body.projectId } : {}),
        // Exclude pledges where a review with an actual star rating
        // already exists.
        NOT: {
          review: { is: { overallRating: { not: null } } },
        },
        // Only backers we can actually email.
        user: { is: { emailUnsubscribedAt: null, deletedAt: null } },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    if (dryRun) {
      // Also report the total outstanding (ignoring the limit) so the
      // operator knows how many runs it'll take.
      const totalOutstanding = await db.pledge.count({
        where: {
          status: "COMPLETED",
          deletedAt: null,
          ratingRequestSentAt: null,
          ...(deliveredOnly ? { fulfillmentStatus: { in: ["SHIPPED", "DELIVERED"] } } : {}),
          ...(body.projectId ? { projectId: body.projectId } : {}),
          NOT: { review: { is: { overallRating: { not: null } } } },
          user: { is: { emailUnsubscribedAt: null, deletedAt: null } },
        },
      });
      return NextResponse.json({
        ok: true,
        dryRun: true,
        deliveredOnly,
        wouldSendThisRun: candidates.length,
        totalOutstanding,
        limit,
      });
    }

    let sent = 0;
    let skipped = 0;
    for (const p of candidates) {
      // Sequential with a tiny gap would be ideal for provider rate
      // limits, but maybeSendRatingRequest already routes through the
      // email lib's queue on failure. Run sequentially to avoid a
      // burst; the route's maxDuration covers a 200-row batch.
      const result = await maybeSendRatingRequest(p.id);
      if (result.sent) sent += 1;
      else skipped += 1;
    }

    backlogLogger.info(
      { scanned: candidates.length, sent, skipped, deliveredOnly, projectId: body.projectId },
      "Rating-request backlog batch complete"
    );

    return NextResponse.json({
      ok: true,
      scanned: candidates.length,
      sent,
      skipped,
      deliveredOnly,
      limit,
      note: "Re-run to continue through the backlog. ratingRequestSentAt dedupes already-sent pledges.",
    });
  } catch (error) {
    backlogLogger.error({ err: formatError(error) }, "Backlog send failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backlog send failed" },
      { status: 500 }
    );
  }
}
