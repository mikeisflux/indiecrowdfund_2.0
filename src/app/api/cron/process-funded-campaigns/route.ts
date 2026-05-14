import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const cronProcessFundedCampaignsLogger = logger.child({ module: "cron-process-funded-campaigns" });
import { db } from "@/lib/db";
import { captureAuthorizedPaypalPledges } from "@/lib/payments/paypal";
import { chargeDcSavedPaymentMethod, verifyDcPayment, handlePaymentSucceeded } from "@/lib/payments/divinitycoin";

// Charge all PENDING DivinityCoin pledges with a saved card (pm_...)
// for a project that has hit its goal. CAS-claim chargedImmediately
// false→true while still PENDING, run /charge-saved-payment-method
// off-session, then COMPLETE on success or roll back the claim +
// schedule a backoff retry on decline.
//
// Idempotency is keyed on pledge.id (also passed to DC as `pledgeId`),
// so a duplicate run for the same pledge returns the original
// PaymentIntent rather than double-charging.
async function captureDcPendingPledges(projectId: string): Promise<{
  total: number;
  successful: number;
  failed: number;
}> {
  const result = { total: 0, successful: 0, failed: 0 };
  const pledges = await db.pledge.findMany({
    where: {
      projectId,
      status: "PENDING",
      paymentProcessor: "DIVINITYCOIN",
      chargedImmediately: false,
      deletedAt: null,
      NOT: { divinityCoinPaymentMethodId: null },
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: new Date() } },
      ],
    },
    select: {
      id: true,
      userId: true,
      amount: true,
      retryCount: true,
      divinityCoinPaymentMethodId: true,
      project: { select: { title: true } },
    },
  });

  const MAX_DC_RETRIES = 5;
  const BACKOFF_HOURS = [1, 6, 24, 72, 168];

  result.total = pledges.length;
  for (const p of pledges) {
    if (!p.divinityCoinPaymentMethodId) continue;

    // Atomic claim — concurrent cron runs see chargedImmediately=true
    // and skip without re-charging.
    const claimed = await db.pledge.updateMany({
      where: {
        id: p.id,
        status: "PENDING",
        chargedImmediately: false,
        divinityCoinPaymentId: null,
        deletedAt: null,
      },
      data: { chargedImmediately: true },
    });
    if (claimed.count === 0) {
      cronProcessFundedCampaignsLogger.info(
        { pledgeId: p.id },
        "[Cron] DC pledge already claimed by a concurrent worker; skipping"
      );
      continue;
    }

    try {
      const charge = await chargeDcSavedPaymentMethod({
        platformUserId: p.userId,
        paymentMethodId: p.divinityCoinPaymentMethodId,
        amount: Math.round(Number(p.amount) * 100),
        currency: "usd",
        pledgeId: p.id,
        projectId,
        description: `Pledge to ${p.project.title}`,
      });
      if (charge.success && charge.status === "succeeded" && charge.paymentIntentId) {
        await db.pledge.update({
          where: { id: p.id },
          data: {
            status: "COMPLETED",
            divinityCoinPaymentId: charge.paymentIntentId,
            retryCount: 0,
            nextRetryAt: null,
          },
        });
        result.successful++;
      } else {
        const newRetryCount = (p.retryCount || 0) + 1;
        const reason =
          charge.error ||
          (charge.declineCode ? `Card declined: ${charge.declineCode}` : "DivinityCoin declined");
        if (newRetryCount >= MAX_DC_RETRIES) {
          await db.pledge.update({
            where: { id: p.id },
            data: {
              status: "FAILED",
              chargedImmediately: false,
              retryCount: newRetryCount,
              nextRetryAt: null,
              lastFailureReason: `${reason} (after ${newRetryCount} attempts)`,
            },
          });
        } else {
          const backoffHours = BACKOFF_HOURS[Math.min(newRetryCount - 1, BACKOFF_HOURS.length - 1)];
          const nextRetryAt = new Date(Date.now() + backoffHours * 60 * 60 * 1000);
          await db.pledge.update({
            where: { id: p.id },
            data: {
              chargedImmediately: false,
              retryCount: newRetryCount,
              nextRetryAt,
              lastFailureReason: reason,
            },
          });
        }
        result.failed++;
      }
    } catch (err) {
      cronProcessFundedCampaignsLogger.error(
        { err: err instanceof Error ? err.message : String(err), pledgeId: p.id },
        "[Cron] DC charge error"
      );
      // Network / HTTP error: uncertain whether DC captured. Don't mark
      // FAILED (idempotency on pledgeId means a retry returns the same
      // PI if it succeeded). Roll the claim back and schedule a retry.
      const newRetryCount = (p.retryCount || 0) + 1;
      const backoffHours =
        BACKOFF_HOURS[Math.min(newRetryCount - 1, BACKOFF_HOURS.length - 1)];
      const nextRetryAt = new Date(Date.now() + backoffHours * 60 * 60 * 1000);
      await db.pledge
        .updateMany({
          where: { id: p.id, status: "PENDING", divinityCoinPaymentId: null },
          data: {
            chargedImmediately: false,
            retryCount: newRetryCount,
            nextRetryAt,
          },
        })
        .catch(() => null);
      result.failed++;
    }
  }
  return result;
}

// Safety net for the immediate-charge flow. When an AoN campaign is
// funded (or KIA), new pledges charge at checkout and DC fires a
// payment.succeeded webhook that flips the pledge PENDING -> COMPLETED.
// If that webhook is ever missed or delayed, the pledge is stuck PENDING
// — already charged and counted by /confirm, but never COMPLETED and
// with no transaction record. This verifies such pledges directly
// against DC and finishes the ones that actually settled, reusing the
// exact webhook completion path so it stays idempotent.
async function verifyStuckDcImmediateCharges(
  projectId: string
): Promise<{ checked: number; completed: number }> {
  const result = { checked: 0, completed: 0 };
  const cutoff = new Date(Date.now() - 10 * 60 * 1000); // 10-min webhook grace
  const stuck = await db.pledge.findMany({
    where: {
      projectId,
      status: "PENDING",
      paymentProcessor: "DIVINITYCOIN",
      chargedImmediately: true,
      deletedAt: null,
      NOT: { divinityCoinPaymentId: null },
      createdAt: { lt: cutoff },
    },
    select: { id: true, divinityCoinPaymentId: true },
    take: 100, // bound DC API calls per tick; the rest get the next tick
  });
  result.checked = stuck.length;
  for (const p of stuck) {
    if (!p.divinityCoinPaymentId) continue;
    try {
      const verified = await verifyDcPayment(p.divinityCoinPaymentId);
      if (!verified.success) continue; // transient — re-checked next tick
      if (verified.status === "succeeded") {
        // Reuse the webhook's completion path — idempotent + CAS-guarded,
        // so it's safe even if the real webhook lands moments later.
        await handlePaymentSucceeded({
          pledgeId: p.id,
          paymentId: p.divinityCoinPaymentId,
        });
        result.completed++;
        cronProcessFundedCampaignsLogger.info(
          { pledgeId: p.id },
          "[Cron] Completed a stuck immediate-charge DC pledge via verify-payment"
        );
      } else if (verified.status === "failed") {
        // A genuinely-failed charge stuck PENDING is rare here (it needs
        // both a missed payment.failed webhook and a /confirm that
        // optimistically counted it). Don't mutate from the cron — the
        // stats rollback is delicate; surface it loudly for manual review.
        cronProcessFundedCampaignsLogger.warn(
          { pledgeId: p.id, paymentIntentId: p.divinityCoinPaymentId },
          "[Cron] DC verify-payment reports FAILED for a stuck immediate-charge pledge — needs manual review"
        );
      }
      // "pending" — leave it; the cron re-checks next tick.
    } catch (err) {
      cronProcessFundedCampaignsLogger.error(
        { err: err instanceof Error ? err.message : String(err), pledgeId: p.id },
        "[Cron] DC payment verification error"
      );
    }
  }
  return result;
}

// Cron job endpoint for processing pending pledges on funded campaigns
//
// This actively checks for campaigns that have crossed their funding goal
// and processes all pending pledges (charges saved payment methods).
//
// This serves as an "event listener" that catches:
// - Campaigns that just reached their goal
// - Any missed webhook processing
// - Edge cases where pledges weren't charged
//
// Schedule: Every 5 minutes for responsive processing
// Vercel cron config in vercel.json: "schedule": "*/5 * * * *"
//
// Security: Protected by CRON_SECRET environment variable
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find funded projects that have pending pledges waiting to be charged
    // A project is "funded" when currentAmount >= goalAmount
    const fundedProjectsWithPendingPledges = await db.project.findMany({
      where: {
        status: { in: ["LIVE", "FUNDED"] },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        currentAmount: true,
        goalAmount: true,
        campaignType: true,
        paymentProcessor: true,
        _count: {
          select: {
            pledges: {
              where: {
                status: "PENDING",
                chargedImmediately: false,
                NOT: { divinityCoinPaymentMethodId: null },
              },
            },
          },
        },
      },
    });

    // Filter to only projects that are funded (or KEEP_IT_ALL) and have pending pledges
    const projectsToProcess = fundedProjectsWithPendingPledges.filter(
      (project) =>
        (project.campaignType === "KEEP_IT_ALL" || Number(project.currentAmount) >= Number(project.goalAmount)) &&
        project._count.pledges > 0
    );

    const results = {
      projectsChecked: fundedProjectsWithPendingPledges.length,
      projectsToProcess: projectsToProcess.length,
      processed: [] as {
        projectId: string;
        projectTitle: string;
        total: number;
        successful: number;
        failed: number;
        verifiedStuck?: number;
        verifiedCompleted?: number;
      }[],
      totalPledgesProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
    };

    // All funded projects get PayPal capture + DC saved-card capture.
    const fundedProjects = fundedProjectsWithPendingPledges.filter(
      (project) =>
        project.campaignType === "KEEP_IT_ALL" ||
        Number(project.currentAmount) >= Number(project.goalAmount)
    );

    for (const project of fundedProjects) {
      try {
        // Always capture authorized PayPal pledges (independent of DC)
        await captureAuthorizedPaypalPledges(project.id).catch(err =>
          cronProcessFundedCampaignsLogger.error({ err: String(err) }, `[Cron] PayPal capture error for project ${project.id}`)
        );

        // Charge any PENDING DivinityCoin saved cards (pm_...). DC AoN
        // campaigns save the card via SetupIntent at pledge time and
        // defer the off-session capture to here.
        const dcResults = await captureDcPendingPledges(project.id).catch((err) => {
          cronProcessFundedCampaignsLogger.error(
            { err: String(err) },
            `[Cron] DC capture error for project ${project.id}`
          );
          return { total: 0, successful: 0, failed: 0 };
        });

        // Safety net: finish any immediate-charge pledges that charged at
        // checkout but got stuck PENDING because their payment.succeeded
        // webhook was missed or delayed.
        const dcVerifyResults = await verifyStuckDcImmediateCharges(project.id).catch((err) => {
          cronProcessFundedCampaignsLogger.error(
            { err: String(err) },
            `[Cron] DC verify-stuck error for project ${project.id}`
          );
          return { checked: 0, completed: 0 };
        });

        results.processed.push({
          projectId: project.id,
          projectTitle: project.title,
          ...dcResults,
          verifiedStuck: dcVerifyResults.checked,
          verifiedCompleted: dcVerifyResults.completed,
        });

        results.totalPledgesProcessed += dcResults.total;
        results.totalSuccessful += dcResults.successful + dcVerifyResults.completed;
        results.totalFailed += dcResults.failed;

        cronProcessFundedCampaignsLogger.info(`[Cron] Processed funded campaign "${project.title}": ${dcResults.successful}/${dcResults.total} saved-card charged, ${dcVerifyResults.completed}/${dcVerifyResults.checked} stuck immediate-charge completed`);
      } catch (error) {
        cronProcessFundedCampaignsLogger.error({ err: error }, `[Cron] Error processing pledges for project ${project.id}:`);
        results.processed.push({
          projectId: project.id,
          projectTitle: project.title,
          total: project._count.pledges,
          successful: 0,
          failed: project._count.pledges,
        });
        results.totalFailed += project._count.pledges;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    cronProcessFundedCampaignsLogger.error({ err: String(error) }, "Process funded campaigns cron error:");
    return NextResponse.json(
      { error: "Failed to process funded campaigns" },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(req: NextRequest) {
  return GET(req);
}
