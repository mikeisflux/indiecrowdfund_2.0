import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { refundRecoup, waiveRecoup } from "@/lib/payments/chargeback-recoup";
import { withDisputeState, readDisputeState } from "@/lib/payments/dispute-state";
import { reconcileStretchGoalsForPledge } from "@/lib/rewards/stretch-goals";
import { claimAddonSlots } from "@/lib/payments/rewards";

const log = logger.child({ module: "chargeback-reversal" });

/**
 * The reverse of applyChargeback, for a backer whose disputes were withdrawn
 * or decided in the platform's favour.
 *
 * applyChargeback does four things at once: marks the pledge CHARGEBACK and
 * un-counts it, bans the backer, and charges the creator's protection card
 * for the disputed amount plus the dispute fee. Until now nothing undid any
 * of that: an admin could unban the backer, but the creator stayed out of
 * pocket for a dispute that never cost the platform anything, and the
 * pledge stayed dead. Unbanning is the admin's signal that the disputes are
 * resolved in the backer's favour, so it now sweeps that backer's recoups:
 *
 *   CHARGED              → refunded to the creator's card (refundRecoup)
 *   PENDING/FAILED/HELD  → waived, so the retry cron never collects it
 *   already closed       → left alone
 *
 * Restoring the pledges themselves (CHARGEBACK → COMPLETED, re-counted,
 * slots re-claimed) is optional and off by default: it is right when the
 * backer withdrew the dispute and the money stayed with us, wrong when the
 * money went back to the backer. The admin says which.
 */

export interface RecoupReversal {
  recoupId: string;
  pledgeId: string | null;
  projectTitle: string;
  creatorEmail: string | null;
  amount: number;
  previousStatus: string;
  action: "refunded" | "waived" | "skipped" | "failed" | "would_refund" | "would_waive";
  error?: string;
}

export interface PledgeReversal {
  pledgeId: string;
  projectTitle: string;
  amount: number;
  previousStatus: string;
  action: "restored" | "skipped" | "would_restore" | "failed";
  note?: string;
}

export interface ChargebackReversalResult {
  userId: string;
  email: string | null;
  dryRun: boolean;
  recoups: RecoupReversal[];
  refundedTotal: number;
  waivedTotal: number;
  pledges: PledgeReversal[];
  summary: string;
}

export async function reverseChargebacksForBacker(opts: {
  userId: string;
  adminId: string;
  reason: string;
  restorePledges?: boolean;
  dryRun?: boolean;
}): Promise<ChargebackReversalResult> {
  const { userId, adminId, reason, restorePledges = false, dryRun = false } = opts;

  const user = await db.user.findFirst({ where: { id: userId }, select: { email: true } });
  const pledges = await db.pledge.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true, status: true, amount: true, projectId: true, rewardId: true, confirmationEmailSent: true, fulfillmentStatus: true, metadata: true,
      project: { select: { title: true, creator: { select: { email: true } } } },
      addons: { select: { addonId: true, quantity: true } },
    },
  });
  const pledgeById = new Map(pledges.map((p) => [p.id, p]));

  const recoupRows = pledges.length
    ? await db.chargebackRecoup.findMany({
        where: { kind: "CHARGEBACK", pledgeId: { in: pledges.map((p) => p.id) } },
        orderBy: { createdAt: "asc" },
        select: { id: true, pledgeId: true, projectId: true, amount: true, status: true },
      })
    : [];

  const recoups: RecoupReversal[] = [];
  let refundedTotal = 0;
  let waivedTotal = 0;
  for (const r of recoupRows) {
    const pledge = r.pledgeId ? pledgeById.get(r.pledgeId) : undefined;
    const base = {
      recoupId: r.id,
      pledgeId: r.pledgeId,
      projectTitle: pledge?.project.title ?? r.projectId,
      creatorEmail: pledge?.project.creator?.email ?? null,
      amount: Number(r.amount),
      previousStatus: r.status,
    };
    if (r.status === "CHARGED") {
      if (dryRun) {
        recoups.push({ ...base, action: "would_refund" });
        continue;
      }
      const res = await refundRecoup(r.id, adminId, reason);
      if (res.ok) {
        refundedTotal += Number(r.amount);
        recoups.push({ ...base, action: "refunded" });
      } else {
        recoups.push({ ...base, action: "failed", error: res.error });
      }
    } else if (r.status === "PENDING" || r.status === "FAILED" || r.status === "HELD_BACK") {
      if (dryRun) {
        recoups.push({ ...base, action: "would_waive" });
        continue;
      }
      const ok = await waiveRecoup(r.id, adminId, reason);
      if (ok) waivedTotal += Number(r.amount);
      recoups.push({ ...base, action: ok ? "waived" : "skipped" });
    } else {
      recoups.push({ ...base, action: "skipped" });
    }
  }

  const pledgeResults: PledgeReversal[] = [];
  for (const p of pledges) {
    if (p.status !== "CHARGEBACK") continue;
    const base = { pledgeId: p.id, projectTitle: p.project.title, amount: Number(p.amount), previousStatus: p.status };
    if (!restorePledges) {
      pledgeResults.push({ ...base, action: "skipped", note: "Left as CHARGEBACK; pass restorePledges to reinstate withdrawn disputes." });
      continue;
    }
    if (dryRun) {
      pledgeResults.push({ ...base, action: "would_restore" });
      continue;
    }
    try {
      await restorePledge(p);
      pledgeResults.push({ ...base, action: "restored" });
    } catch (err) {
      pledgeResults.push({ ...base, action: "failed", note: err instanceof Error ? err.message : String(err) });
    }
  }

  const refundedCount = recoups.filter((r) => r.action === "refunded" || r.action === "would_refund").length;
  const waivedCount = recoups.filter((r) => r.action === "waived" || r.action === "would_waive").length;
  const failed = recoups.filter((r) => r.action === "failed").length;
  const restored = pledgeResults.filter((p) => p.action === "restored" || p.action === "would_restore").length;
  const summary = [
    `${dryRun ? "Would refund" : "Refunded"} ${refundedCount} creator recoup${refundedCount === 1 ? "" : "s"} ($${(dryRun ? recoups.filter((r) => r.action === "would_refund").reduce((s, r) => s + r.amount, 0) : refundedTotal).toFixed(2)})`,
    waivedCount ? `${dryRun ? "would waive" : "waived"} ${waivedCount} uncollected` : null,
    failed ? `${failed} FAILED` : null,
    restorePledges ? `${dryRun ? "would restore" : "restored"} ${restored} pledge${restored === 1 ? "" : "s"}` : `${pledgeResults.length} pledge${pledgeResults.length === 1 ? "" : "s"} left as CHARGEBACK`,
  ]
    .filter(Boolean)
    .join("; ");

  if (!dryRun) {
    log.info({ userId, adminId, refundedTotal, waivedTotal, restored, failed, reason }, "chargeback reversal swept for backer");
  }
  return { userId, email: user?.email ?? null, dryRun, recoups, refundedTotal, waivedTotal, pledges: pledgeResults, summary };
}

/** CHARGEBACK → COMPLETED, mirroring applyChargeback's bookkeeping in reverse. */
async function restorePledge(p: {
  id: string;
  projectId: string;
  rewardId: string | null;
  amount: unknown;
  confirmationEmailSent: boolean;
  fulfillmentStatus: string;
  metadata: unknown;
  addons: { addonId: string; quantity: number }[];
}): Promise<void> {
  const prior = readDisputeState(p.metadata) ?? {};
  const cas = await db.pledge.updateMany({
    where: { id: p.id, status: "CHARGEBACK", deletedAt: null },
    data: {
      status: "COMPLETED",
      lastFailureReason: null,
      metadata: withDisputeState(p.metadata, { ...prior, status: "withdrawn" }),
    },
  });
  if (cas.count === 0) throw new Error("Pledge status changed concurrently");

  if (p.confirmationEmailSent) {
    await db.project.update({ where: { id: p.projectId }, data: { backerCount: { increment: 1 }, currentAmount: { increment: Number(p.amount) } } });
    const wasShipped = !["NOT_STARTED", "IN_PROGRESS"].includes(p.fulfillmentStatus);
    // applyChargeback only released slots on unshipped orders; re-claim on
    // exactly the same condition so the counts round-trip.
    if (!wasShipped) {
      if (p.rewardId) {
        await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = "quantityClaimed" + 1 WHERE id = ${p.rewardId}`;
      }
      if (p.addons.length > 0) {
        await claimAddonSlots(p.addons.map((a) => ({ id: a.addonId, quantity: a.quantity }))).catch(() => false);
      }
    }
  }
  try {
    await reconcileStretchGoalsForPledge(p.id);
  } catch (err) {
    log.warn({ err: String(err), pledgeId: p.id }, "stretch goal reconcile after restore failed");
  }
}

/**
 * A single dispute ended in the platform's favour (withdrawn by the
 * cardholder, or won). Refund/waive the recoup for THAT pledge, reinstate
 * the pledge, and — when the backer has no other open dispute — lift the
 * chargeback ban, since the ban exists only because of the dispute. Returns
 * what happened so the webhook can log it and tell the admins.
 */
export async function resolveDisputeForPledge(opts: {
  pledgeId: string;
  outcome: "withdrawn" | "won";
  processor: string;
  disputeId?: string;
  actorId?: string;
}): Promise<{
  pledgeId: string;
  userId: string | null;
  recoupsRefunded: number;
  refundedTotal: number;
  recoupsWaived: number;
  pledgeRestored: boolean;
  unbanned: boolean;
  remainingDisputes: number;
  message: string;
}> {
  const { pledgeId, outcome, processor, disputeId } = opts;
  const actorId = opts.actorId ?? `system:dispute-${outcome}`;
  const reason = `Dispute ${disputeId ?? ""} ${outcome} (${processor})`.replace(/\s+/g, " ").trim();

  const pledge = await db.pledge.findFirst({
    where: { id: pledgeId, deletedAt: null },
    select: {
      id: true, status: true, userId: true, projectId: true, rewardId: true, amount: true, confirmationEmailSent: true, fulfillmentStatus: true, metadata: true,
      addons: { select: { addonId: true, quantity: true } },
    },
  });
  if (!pledge) {
    return { pledgeId, userId: null, recoupsRefunded: 0, refundedTotal: 0, recoupsWaived: 0, pledgeRestored: false, unbanned: false, remainingDisputes: 0, message: "Pledge not found" };
  }

  const recoups = await db.chargebackRecoup.findMany({
    where: { pledgeId, kind: "CHARGEBACK", status: { in: ["CHARGED", "PENDING", "FAILED", "HELD_BACK"] } },
    select: { id: true, status: true, amount: true },
  });
  let recoupsRefunded = 0;
  let refundedTotal = 0;
  let recoupsWaived = 0;
  for (const r of recoups) {
    if (r.status === "CHARGED") {
      const res = await refundRecoup(r.id, actorId, reason);
      if (res.ok) {
        recoupsRefunded += 1;
        refundedTotal += Number(r.amount);
      } else {
        log.error({ recoupId: r.id, err: res.error }, "dispute resolved but recoup refund failed");
      }
    } else if (await waiveRecoup(r.id, actorId, reason)) {
      recoupsWaived += 1;
    }
  }

  let pledgeRestored = false;
  if (pledge.status === "CHARGEBACK") {
    try {
      await restorePledge(pledge);
      pledgeRestored = true;
    } catch (err) {
      log.error({ pledgeId, err: String(err) }, "dispute resolved but pledge restore failed");
    }
  } else {
    // Not CHARGEBACK (e.g. already restored); still stamp the outcome.
    const prior = readDisputeState(pledge.metadata) ?? {};
    await db.pledge.update({ where: { id: pledgeId }, data: { metadata: withDisputeState(pledge.metadata, { ...prior, status: outcome }) } }).catch(() => {});
  }

  // Lift the ban only when nothing else is still disputed. The ban is the
  // policy's response to an open chargeback; once every one of this
  // person's disputes has gone our way there is nothing left to enforce.
  const remainingDisputes = await db.pledge.count({ where: { userId: pledge.userId, status: "CHARGEBACK", deletedAt: null } });
  let unbanned = false;
  if (remainingDisputes === 0) {
    const res = await db.user.updateMany({
      where: { id: pledge.userId, NOT: { bannedAt: null } },
      data: { bannedAt: null, bannedReason: null, bannedById: null, lockedAt: null, lockedReason: null, lockedById: null },
    });
    unbanned = res.count > 0;
  }

  const message = `Dispute ${outcome}: ${recoupsRefunded} recoup(s) refunded ($${refundedTotal.toFixed(2)}), ${recoupsWaived} waived, pledge ${pledgeRestored ? "restored" : "unchanged"}, backer ${unbanned ? "unbanned" : remainingDisputes > 0 ? `still has ${remainingDisputes} open dispute(s)` : "was not banned"}`;
  log.info({ pledgeId, userId: pledge.userId, outcome, recoupsRefunded, refundedTotal, recoupsWaived, pledgeRestored, unbanned, remainingDisputes }, message);
  return { pledgeId, userId: pledge.userId, recoupsRefunded, refundedTotal, recoupsWaived, pledgeRestored, unbanned, remainingDisputes, message };
}

/** Backers with charged-or-open recoups who are no longer banned: candidates for a sweep. */
export async function findUnbannedBackersWithRecoups(limit = 50): Promise<{ userId: string; email: string; name: string | null; recoups: number; charged: number }[]> {
  const rows = await db.chargebackRecoup.findMany({
    where: { kind: "CHARGEBACK", status: { in: ["CHARGED", "PENDING", "FAILED", "HELD_BACK"] }, NOT: { pledgeId: null } },
    select: { pledgeId: true, status: true, amount: true },
  });
  if (rows.length === 0) return [];
  const pledges = await db.pledge.findMany({
    where: { id: { in: rows.map((r: { pledgeId: string | null }) => r.pledgeId as string) } },
    select: { id: true, user: { select: { id: true, email: true, name: true, bannedAt: true, deletedAt: true } } },
  });
  const byPledge = new Map(pledges.map((p) => [p.id, p.user]));
  const agg = new Map<string, { userId: string; email: string; name: string | null; recoups: number; charged: number }>();
  for (const r of rows) {
    const u = byPledge.get(r.pledgeId as string);
    if (!u || u.bannedAt || u.deletedAt) continue;
    const cur = agg.get(u.id) ?? { userId: u.id, email: u.email, name: u.name, recoups: 0, charged: 0 };
    cur.recoups += 1;
    if (r.status === "CHARGED") cur.charged += Number(r.amount);
    agg.set(u.id, cur);
  }
  return [...agg.values()].sort((a, b) => b.charged - a.charged).slice(0, limit);
}
