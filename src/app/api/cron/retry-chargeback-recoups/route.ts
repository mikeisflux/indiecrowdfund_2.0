import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { attemptRecoupCharge } from "@/lib/payments/chargeback-recoup";

const log = logger.child({ module: "cron-retry-chargeback-recoups" });

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PER_TICK = 50;

// Retry chargeback recoups whose card declined or was missing, on the
// backoff schedule written by the recoup library, and pick up any PENDING
// row whose first attempt never completed (process died mid-charge).
//
// Suggested crontab (hourly):
//   0 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://indiecrowdfund.com/api/cron/retry-chargeback-recoups
//
// Security: protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const stalePending = new Date(now.getTime() - 10 * 60 * 1000);
    const due = await db.chargebackRecoup.findMany({
      where: {
        OR: [
          { status: "FAILED", nextAttemptAt: { lte: now } },
          { status: "PENDING", createdAt: { lte: stalePending } },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: MAX_PER_TICK,
    });

    const results = { checked: due.length, charged: 0, failed: 0, heldBack: 0 };
    for (const r of due) {
      const res = await attemptRecoupCharge(r.id).catch((err) => {
        log.error({ err: formatError(err), recoupId: r.id }, "retry threw");
        return { status: "error" };
      });
      if (res.status === "CHARGED") results.charged++;
      else if (res.status === "HELD_BACK") results.heldBack++;
      else results.failed++;
    }

    log.info(results, "Chargeback recoup retry tick");
    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    log.error({ err: formatError(error) }, "retry-chargeback-recoups failed");
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
