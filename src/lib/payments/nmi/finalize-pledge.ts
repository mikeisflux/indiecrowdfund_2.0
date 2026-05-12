import { db } from "@/lib/db";
import {
  claimRewardSlot,
  claimAddonSlots,
  assignBackerNumber,
} from "@/lib/payments/stripe/rewards";
import { notifyPledgeReceived } from "@/lib/notifications";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "nmi-finalize-pledge" });

/**
 * Apply the side effects every payment processor needs after a pledge
 * transitions to COMPLETED:
 *   - Bump Project.currentAmount + backerCount
 *   - Reserve the main reward slot (Reward.quantityClaimed)
 *   - Reserve addon slots
 *   - Assign a permanent backer number
 *   - Fire the creator pledge-received notification
 *
 * Stripe, PayPal, and Whop have always called this same sequence in
 * their respective confirm flows — NMI/Mentom Payments didn't, which
 * left reward cards showing "0 backers" and creator dashboards stuck
 * at the project's pre-launch totals even after thousands of NMI
 * pledges completed.
 *
 * Idempotent on idempotency-key (call once per pledge transition):
 * the caller is expected to perform the PENDING→COMPLETED status
 * transition via a conditional updateMany / update and ONLY call this
 * helper if the transition actually claimed a row. Re-running this
 * after a successful first call WILL double-count, so guard at the
 * call site.
 */
export async function finalizeNmiPledge(pledgeId: string): Promise<void> {
  const pledge = await db.pledge.findUnique({
    where: { id: pledgeId },
    select: {
      id: true,
      amount: true,
      projectId: true,
      rewardId: true,
      backerNumber: true,
      user: { select: { name: true } },
      project: { select: { creatorId: true } },
      addons: { select: { addonId: true, quantity: true } },
    },
  });

  if (!pledge) {
    log.warn({ pledgeId }, "finalizeNmiPledge: pledge not found");
    return;
  }

  // Idempotency guard. NMI pledges have historically had their counter
  // bumps applied at pledge-create time (or via admin reconciliation),
  // not at completion. A non-null backerNumber means the pledge was
  // already counted toward Project.backerCount / Reward.quantityClaimed
  // by some other path. Running the bumps again from finalize would
  // double-count. The marker we use is pledge.backerNumber — if it's
  // set, we skip the counter side effects entirely. Only the
  // notification fires (so the creator hears about the actual COMPLETED
  // transition).
  if (pledge.backerNumber !== null) {
    log.info(
      { pledgeId, backerNumber: pledge.backerNumber },
      "finalizeNmiPledge: pledge already has backerNumber — counters assumed already bumped, sending notification only"
    );
    await notifyPledgeReceived(
      pledge.projectId,
      pledge.project.creatorId,
      pledge.user.name || "A backer",
      Number(pledge.amount)
    ).catch((err) =>
      log.error({ pledgeId, err: String(err) }, "notifyPledgeReceived failed")
    );
    return;
  }

  // 1. Bump project totals — same pattern as PayPal/Whop confirm.
  await db.project
    .update({
      where: { id: pledge.projectId },
      data: {
        currentAmount: { increment: Number(pledge.amount) },
        backerCount: { increment: 1 },
      },
    })
    .catch((err) =>
      log.error({ pledgeId, err: String(err) }, "project totals bump failed")
    );

  // 2. Reward slot claim (skip if pledge has no reward tier).
  if (pledge.rewardId) {
    await claimRewardSlot(pledge.rewardId).catch((err) =>
      log.error({ pledgeId, err: String(err) }, "claimRewardSlot failed")
    );
  }

  // 3. Addon slot claims.
  if (pledge.addons?.length) {
    await claimAddonSlots(
      pledge.addons.map((a: { addonId: string; quantity: number }) => ({
        id: a.addonId,
        quantity: a.quantity,
      }))
    ).catch((err) =>
      log.error({ pledgeId, err: String(err) }, "claimAddonSlots failed")
    );
  }

  // 4. Assign backer number — first-funded gets #1.
  await assignBackerNumber(pledge.projectId, pledge.id).catch((err) =>
    log.error({ pledgeId, err: String(err) }, "assignBackerNumber failed")
  );

  // 5. Notify the creator.
  await notifyPledgeReceived(
    pledge.projectId,
    pledge.project.creatorId,
    pledge.user.name || "A backer",
    Number(pledge.amount)
  ).catch((err) =>
    log.error({ pledgeId, err: String(err) }, "notifyPledgeReceived failed")
  );
}
