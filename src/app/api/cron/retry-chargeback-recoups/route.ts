import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { attemptRecoupCharge, recoverAllProjects } from "@/lib/payments/chargeback-recoup";
import { findUnbannedBackersWithRecoups, reverseChargebacksForBacker } from "@/lib/payments/chargeback-reversal";
import { alertAdmins } from "@/lib/admin-alerts";

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

    // Once a day (the 03:xx UTC tick, or ?scan=1), walk every ended
    // campaign for disputes without a recoup and negative balances.
    const url = new URL(req.url);
    const wantScan = url.searchParams.get("scan") === "1" || now.getUTCHours() === 3;
    let scan: { scanned: number; charged: number; stillOpen: number } | undefined;
    if (wantScan) {
      const all = await recoverAllProjects();
      scan = {
        scanned: all.length,
        charged: all.reduce((s, r) => s + r.charged, 0),
        stillOpen: all.reduce((s, r) => s + r.stillOpen, 0),
      };
    }

    // Reverse sweep, every tick: a backer who is no longer banned but whose
    // pledges still carry a charged or open recoup was unbanned by some path
    // that did not run the reversal (direct SQL, an older build, the unlock
    // action before it swept). The unban is the admin's decision that the
    // disputes are resolved, so the creators get their recoups back now
    // rather than never. Pledges are not reinstated here — only the admin
    // knows whether the money stayed — so this is the "refund the creator"
    // half, which is the half that is always right once the ban is lifted.
    const reversal = { backers: 0, refunded: 0, refundedTotal: 0, waived: 0, failed: 0 };
    try {
      const candidates = await findUnbannedBackersWithRecoups(25);
      for (const c of candidates) {
        const r = await reverseChargebacksForBacker({
          userId: c.userId,
          adminId: "system:unban-sweep",
          reason: "Backer is no longer banned; disputes treated as resolved (hourly sweep)",
        });
        reversal.backers += 1;
        reversal.refunded += r.recoups.filter((x) => x.action === "refunded").length;
        reversal.refundedTotal += r.refundedTotal;
        reversal.waived += r.recoups.filter((x) => x.action === "waived").length;
        reversal.failed += r.recoups.filter((x) => x.action === "failed").length;
      }
      if (reversal.backers > 0) {
        await alertAdmins({
          title: `Chargeback sweep: $${reversal.refundedTotal.toFixed(2)} refunded to creators`,
          message: `${reversal.backers} unbanned backer(s) still had recoups on their pledges. Refunded ${reversal.refunded} charged recoup(s), waived ${reversal.waived} uncollected${reversal.failed ? `, ${reversal.failed} FAILED (see Sentinel)` : ""}. Their pledges remain marked CHARGEBACK; use Refund Chargeback Fees on the user to restore them if the money stayed.`,
          actionUrl: "/admin/users",
          email: reversal.failed > 0,
          throttleKey: "chargeback-unban-sweep",
          throttleMinutes: 55,
        }).catch(() => {});
      }
    } catch (err) {
      log.error({ err: formatError(err) }, "unban reversal sweep failed");
    }

    log.info({ ...results, scan, reversal }, "Chargeback recoup retry tick");
    return NextResponse.json({ ok: true, ...results, scan, reversal });
  } catch (error) {
    log.error({ err: formatError(error) }, "retry-chargeback-recoups failed");
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
