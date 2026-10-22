import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";
import { unwindCountedPledge } from "@/lib/payments/unwind-counted-pledge";
import { getPayPalConfig, getPayPalAccessToken } from "@/lib/payments/paypal";
import { sendPledgeCancellationEmail } from "@/lib/email/email-templates-pledge";
import { sendCampaignWoundDownEmail } from "@/lib/email/email-templates-misc";
import { createNotification } from "@/lib/notifications/core";

const log = logger.child({ module: "project-wind-down" });

/**
 * Minimum share of the goal a campaign must reach to be paid out. Below
 * this, every pledge is refunded whether the campaign was All-or-Nothing
 * or Keep-It-All: the fixed costs of processing, paying out and
 * supporting fulfilment exceed what such a campaign raises. Stated in the
 * Terms of Service (section 6).
 */
export const MIN_FUNDING_RATIO = 0.6;

export function meetsMinimumFunding(currentAmount: unknown, goalAmount: unknown): boolean {
  const goal = Number(goalAmount);
  if (!goal || goal <= 0) return true;
  return Number(currentAmount) >= goal * MIN_FUNDING_RATIO;
}

export type WindDownCause = "under-minimum" | "not-funded" | "admin";

export interface WindDownResult {
  projectId: string;
  title: string;
  /** Status the project ended in, or the reason nothing was done. */
  outcome: "FAILED" | "CANCELLED" | "skipped";
  skippedReason?: string;
  dcRefunded: number;
  dcRefundedAmount: number;
  dcRefundFailed: number;
  dcPendingCancelled: number;
  stripeCancelled: number;
  paypalCancelled: number;
  whopPendingCancelled: number;
  /** Charged Whop pledges: reversal has to be done in the Whop dashboard. */
  whopNeedsManualRefund: number;
  backersEmailed: number;
  creatorEmailed: boolean;
}

/**
 * End a campaign and give the money back.
 *
 * One path for three callers: the ended-campaign cron (All-or-Nothing that
 * missed its goal, or any campaign under the minimum funding ratio), and
 * the admin "wind down" button on the payouts page. Refunds every charged
 * DivinityCoin pledge, cancels everything uncharged, emails every backer,
 * and tells the creator — politely — what happened and why.
 *
 * Refuses to touch a campaign that has already been paid out: that is a
 * recoup, not a wind-down.
 */
export async function windDownProject(input: {
  projectId: string;
  cause: WindDownCause;
  /** Status to leave the project in. Cron uses FAILED; admin uses CANCELLED. */
  outcome: "FAILED" | "CANCELLED";
  /** Shown to the creator (admin cause only). */
  note?: string;
  actorId?: string;
  notifyCreator?: boolean;
}): Promise<WindDownResult> {
  const project = await db.project.findFirst({
    where: { id: input.projectId, deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      goalAmount: true,
      currentAmount: true,
      campaignType: true,
      paymentProcessor: true,
      creator: { select: { id: true, name: true, email: true, vanityUrl: true } },
      divinityCoinSettlements: { where: { status: "COMPLETED" }, select: { id: true } },
    },
  });
  const empty = (title: string): WindDownResult => ({
    projectId: input.projectId,
    title,
    outcome: "skipped",
    dcRefunded: 0,
    dcRefundedAmount: 0,
    dcRefundFailed: 0,
    dcPendingCancelled: 0,
    stripeCancelled: 0,
    paypalCancelled: 0,
    whopPendingCancelled: 0,
    whopNeedsManualRefund: 0,
    backersEmailed: 0,
    creatorEmailed: false,
  });
  if (!project) return { ...empty(""), skippedReason: "Project not found" };
  if (project.divinityCoinSettlements.length > 0) {
    return { ...empty(project.title), skippedReason: "Campaign has already been paid out — use a recoup instead" };
  }

  // Only a campaign that is live, approved-but-unlaunched, or just closed
  // as funded (not yet paid) can be wound down.
  const from = ["LIVE", "FUNDED", "APPROVED", "SUBMITTED"] as const;
  if (!(from as readonly string[]).includes(project.status)) {
    return { ...empty(project.title), skippedReason: `Campaign is ${project.status}; nothing to wind down` };
  }
  const cas = await db.project.updateMany({
    where: { id: project.id, status: { in: [...from] }, deletedAt: null },
    data: {
      status: input.outcome,
      prelaunchActive: false,
    },
  });
  if (cas.count === 0) {
    return { ...empty(project.title), skippedReason: "Campaign status changed under us; nothing done" };
  }

  const reasonText =
    input.cause === "under-minimum"
      ? `Campaign ended below ${Math.round(MIN_FUNDING_RATIO * 100)}% of its funding goal`
      : input.cause === "not-funded"
        ? "Campaign did not reach funding goal"
        : input.note?.trim() || "Campaign wound down by IndieCrowdfund";

  const result: WindDownResult = { ...empty(project.title), outcome: input.outcome };
  const projectPath = project.creator.vanityUrl ? `/projects/${project.creator.vanityUrl}/${project.slug}` : `/projects/${project.slug}`;

  // 1. Charged DivinityCoin pledges → refund at DC, then REFUNDED here.
  const refund = await refundDivinityCoinPledges(project.id, project.title, reasonText, projectPath);
  result.dcRefunded = refund.count;
  result.dcRefundedAmount = refund.totalAmount;
  result.dcRefundFailed = refund.failed;
  result.backersEmailed += refund.emailed;

  // 2. Uncharged pledges of every processor → CANCELLED, counts unwound.
  const pending = await cancelDivinityCoinPendingPledges(project.id, reasonText, project.title, projectPath);
  result.dcPendingCancelled = pending.count;
  result.backersEmailed += pending.emailed;
  result.stripeCancelled = (await cancelStripePledges(project.id, reasonText)).count;
  result.paypalCancelled = (await cancelPaypalAuthorizedPledges(project.id, reasonText)).count;
  result.whopPendingCancelled = (await cancelWhopPledges(project.id, reasonText)).count;

  // 3. Charged Whop pledges cannot be reversed from here.
  result.whopNeedsManualRefund = await db.pledge.count({
    where: { projectId: project.id, paymentProcessor: "WHOP", status: "COMPLETED", deletedAt: null },
  });

  // 4. The creator.
  if (input.notifyCreator !== false) {
    await createNotification({
      userId: project.creator.id,
      type: "PROJECT_REVIEW",
      title: input.outcome === "CANCELLED" ? "Your campaign has been closed" : "Your campaign has ended",
      message:
        input.cause === "admin"
          ? `"${project.title}" has been closed and all backers refunded. ${input.note?.trim() || ""}`.trim()
          : `"${project.title}" ended below the minimum funding level and all backers have been refunded.`,
      actionUrl: "/dashboard",
      projectId: project.id,
    }).catch(() => {});
    if (project.creator.email) {
      const sent = await sendCampaignWoundDownEmail({
        email: project.creator.email,
        creatorName: project.creator.name || "there",
        projectTitle: project.title,
        goalAmount: Number(project.goalAmount),
        raisedAmount: Number(project.currentAmount),
        cause: input.cause,
        note: input.note?.trim() || null,
        refundedCount: result.dcRefunded + result.dcPendingCancelled + result.stripeCancelled + result.paypalCancelled + result.whopPendingCancelled,
      }).catch((err) => {
        log.warn({ err: String(err), projectId: project.id }, "wind-down creator email failed");
        return { success: false };
      });
      result.creatorEmailed = !!sent.success;
    }
  }

  log.info(
    { ...result, cause: input.cause, actorId: input.actorId ?? null },
    "Campaign wound down"
  );
  return result;
}

/** Pledges that still need a refund after a wind-down (DC refund failed at the processor). */
export async function retryWindDownRefunds(projectId: string): Promise<{ count: number; totalAmount: number }> {
  const project = await db.project.findFirst({
    where: { id: projectId, status: { in: ["FAILED", "CANCELLED"] } },
    select: { id: true, title: true, slug: true, creator: { select: { vanityUrl: true } } },
  });
  if (!project) return { count: 0, totalAmount: 0 };
  const projectPath = project.creator.vanityUrl ? `/projects/${project.creator.vanityUrl}/${project.slug}` : `/projects/${project.slug}`;
  const r = await refundDivinityCoinPledges(project.id, project.title, "Campaign closed", projectPath);
  return { count: r.count, totalAmount: r.totalAmount };
}

// ── Per-processor helpers ─────────────────────────────────────────────────

async function emailBacker(
  pledge: { userId: string; amount: unknown },
  projectTitle: string,
  wasRefunded: boolean,
  projectPath: string
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: pledge.userId },
    select: { email: true, name: true, deletedAt: true },
  });
  if (!user?.email || user.deletedAt) return false;
  try {
    await sendPledgeCancellationEmail(user.email, user.name || "there", projectTitle, Number(pledge.amount), wasRefunded, projectPath);
    return true;
  } catch (err) {
    log.warn({ err: String(err), userId: pledge.userId }, "backer cancellation email failed");
    return false;
  }
}

/**
 * Refund every charged DivinityCoin pledge. A pledge whose refund fails at
 * DC stays COMPLETED so the next pass retries it — marking it REFUNDED
 * with the money still captured is how backers' money got stranded before.
 */
export async function refundDivinityCoinPledges(
  projectId: string,
  projectTitle: string,
  reasonText: string,
  projectPath: string
): Promise<{ count: number; totalAmount: number; failed: number; emailed: number }> {
  const pledges = await db.pledge.findMany({
    where: { projectId, paymentProcessor: "DIVINITYCOIN", status: "COMPLETED", deletedAt: null },
    select: { id: true, userId: true, amount: true, rewardId: true, divinityCoinPaymentId: true, confirmationEmailSent: true },
  });
  let count = 0;
  let totalAmount = 0;
  let failed = 0;
  let emailed = 0;
  for (const pledge of pledges) {
    try {
      const amount = Number(pledge.amount);
      const dcResult = await callDivinityCoinAPI("release", {
        pledgeId: pledge.id,
        paymentId: pledge.divinityCoinPaymentId,
        reason: "campaign_failed",
        refund: true,
      });
      if (!dcResult.success) {
        failed++;
        log.error({ err: dcResult.error, pledgeId: pledge.id }, "DC release/refund failed; pledge left COMPLETED for retry");
        continue;
      }
      await db.$transaction(async (tx) => {
        const cas = await tx.pledge.updateMany({
          where: { id: pledge.id, status: "COMPLETED" },
          data: { status: "REFUNDED", lastFailureReason: reasonText },
        });
        if (cas.count === 0) throw new Error("already refunded");
        if (pledge.rewardId) {
          await tx.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`;
        }
        await tx.divinityCoinTransaction.create({
          data: {
            userId: pledge.userId,
            pledgeId: pledge.id,
            amount: -amount,
            type: "REFUND",
            description: `Refund for closed campaign "${projectTitle}"`,
            metadata: JSON.stringify({
              reason: reasonText,
              projectId,
              originalPaymentId: pledge.divinityCoinPaymentId,
              dcReleaseResult: dcResult.data,
              timestamp: new Date().toISOString(),
            }),
          },
        });
      });
      count++;
      totalAmount += amount;
      await createNotification({
        userId: pledge.userId,
        type: "PLEDGE_REFUNDED",
        title: "Your pledge has been refunded",
        message: `"${projectTitle}" was closed and your $${amount.toFixed(2)} pledge has been refunded to your card.`,
        actionUrl: "/dashboard/backer?tab=backed",
        projectId,
      }).catch(() => {});
      if (await emailBacker(pledge, projectTitle, true, projectPath)) emailed++;
    } catch (error) {
      if (!(error instanceof Error && error.message === "already refunded")) {
        failed++;
        log.error({ err: formatError(error), pledgeId: pledge.id }, "Error refunding pledge");
      }
    }
  }
  return { count, totalAmount, failed, emailed };
}

/** Uncharged DivinityCoin saved-card pledges: nothing to refund, counts come out. */
export async function cancelDivinityCoinPendingPledges(
  projectId: string,
  reasonText: string,
  projectTitle?: string,
  projectPath?: string
): Promise<{ count: number; emailed: number }> {
  const pending = await db.pledge.findMany({
    where: { projectId, paymentProcessor: "DIVINITYCOIN", status: "PENDING", deletedAt: null },
    select: { id: true, projectId: true, userId: true, amount: true, rewardId: true, confirmationEmailSent: true },
  });
  let count = 0;
  let emailed = 0;
  for (const pledge of pending) {
    try {
      const cas = await db.pledge.updateMany({
        where: { id: pledge.id, status: "PENDING", deletedAt: null },
        data: { status: "CANCELLED", lastFailureReason: reasonText },
      });
      if (cas.count > 0) {
        await unwindCountedPledge(pledge);
        count++;
        if (projectTitle && projectPath && pledge.confirmationEmailSent) {
          if (await emailBacker(pledge, projectTitle, false, projectPath)) emailed++;
        }
      }
    } catch (error) {
      log.error({ err: formatError(error), pledgeId: pledge.id }, "Error cancelling DC pending pledge");
    }
  }
  return { count, emailed };
}

export async function cancelStripePledges(projectId: string, reasonText: string): Promise<{ count: number }> {
  const pledges = await db.pledge.findMany({
    where: { projectId, paymentProcessor: "STRIPE", status: "PENDING", chargedImmediately: false, deletedAt: null },
    select: { id: true, rewardId: true },
  });
  for (const pledge of pledges) {
    try {
      await db.$transaction(async (tx) => {
        await tx.pledge.update({ where: { id: pledge.id }, data: { status: "CANCELLED", lastFailureReason: reasonText } });
        if (pledge.rewardId) {
          await tx.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`;
        }
      });
    } catch (error) {
      log.error({ err: formatError(error), pledgeId: pledge.id }, "Error cancelling Stripe pledge");
    }
  }
  return { count: pledges.length };
}

export async function cancelPaypalAuthorizedPledges(projectId: string, reasonText: string): Promise<{ count: number }> {
  const pledges = await db.pledge.findMany({
    where: { projectId, paymentProcessor: "PAYPAL", status: "PENDING", NOT: { paypalAuthorizationId: null }, deletedAt: null },
    select: { id: true, rewardId: true, confirmationEmailSent: true, amount: true, paypalAuthorizationId: true },
  });
  if (pledges.length === 0) return { count: 0 };
  let count = 0;
  try {
    const paypalConfig = await getPayPalConfig();
    const accessToken = await getPayPalAccessToken();
    for (const pledge of pledges) {
      try {
        const voidRes = await fetch(`${paypalConfig.baseUrl}/v2/payments/authorizations/${pledge.paypalAuthorizationId}/void`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        });
        if (!voidRes.ok && voidRes.status !== 422) {
          log.error({ pledgeId: pledge.id, status: voidRes.status }, "Failed to void PayPal authorization");
        }
      } catch (voidErr) {
        log.error({ err: String(voidErr), pledgeId: pledge.id }, "Error voiding PayPal auth");
      }
      await db.$transaction(async (tx) => {
        await tx.pledge.update({ where: { id: pledge.id }, data: { status: "CANCELLED", lastFailureReason: reasonText } });
        if (pledge.confirmationEmailSent) {
          await tx.project.update({
            where: { id: projectId },
            data: { backerCount: { decrement: 1 }, currentAmount: { decrement: Number(pledge.amount) } },
          });
        }
        if (pledge.rewardId) {
          await tx.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`;
        }
      });
      count++;
    }
  } catch (err) {
    log.error({ err: String(err) }, "Error in cancelPaypalAuthorizedPledges");
  }
  return { count };
}

export async function cancelWhopPledges(projectId: string, reasonText: string): Promise<{ count: number }> {
  const pledges = await db.pledge.findMany({
    where: { projectId, paymentProcessor: "WHOP", status: "PENDING", deletedAt: null },
    select: { id: true, rewardId: true, confirmationEmailSent: true, amount: true },
  });
  for (const pledge of pledges) {
    try {
      await db.$transaction(async (tx) => {
        await tx.pledge.update({ where: { id: pledge.id }, data: { status: "CANCELLED", lastFailureReason: reasonText } });
        if (pledge.confirmationEmailSent) {
          await tx.project.update({
            where: { id: projectId },
            data: { backerCount: { decrement: 1 }, currentAmount: { decrement: Number(pledge.amount) } },
          });
        }
        if (pledge.rewardId) {
          await tx.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`;
        }
      });
    } catch (err) {
      log.error({ err: String(err), pledgeId: pledge.id }, "Error cancelling Whop pledge");
    }
  }
  return { count: pledges.length };
}
