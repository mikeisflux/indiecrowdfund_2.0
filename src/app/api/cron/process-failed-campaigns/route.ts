import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const cronProcessFailedCampaignsLogger = logger.child({ module: "cron-process-failed-campaigns" });
import { db } from "@/lib/db";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";
import { getPayPalConfig, getPayPalAccessToken } from "@/lib/payments/paypal";

/**
 * Cron job endpoint for processing ended campaigns
 *
 * This handles campaigns whose endDate has passed:
 * - FUNDED: Projects that met their goal → status set to FUNDED
 * - FAILED: Projects that didn't meet goal → refund DC pledges, cancel Stripe pledges, status set to FAILED
 *
 * Schedule: Every hour
 * Vercel cron config: "schedule": "0 * * * *"
 *
 * Security: Protected by CRON_SECRET environment variable
 */
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

    const now = new Date();

    // Find all LIVE projects whose end date has passed
    const endedProjects = await db.project.findMany({
      where: {
        status: "LIVE",
        deletedAt: null,
        endDate: {
          lt: now, // End date has passed
        },
      },
      select: {
        id: true,
        title: true,
        currentAmount: true,
        goalAmount: true,
        paymentProcessor: true,
        fundedAt: true,
        campaignType: true,
      },
    });

    // Separate into funded and failed
    // KEEP_IT_ALL campaigns are always considered "funded" regardless of goal
    const fundedProjects = endedProjects.filter(
      (project) =>
        project.campaignType === "KEEP_IT_ALL" ||
        Number(project.currentAmount) >= Number(project.goalAmount)
    );
    const failedProjects = endedProjects.filter(
      (project) =>
        project.campaignType !== "KEEP_IT_ALL" &&
        Number(project.currentAmount) < Number(project.goalAmount)
    );

    const results = {
      projectsChecked: endedProjects.length,
      funded: {
        count: 0,
        projects: [] as { id: string; title: string; amount: number }[],
      },
      failed: {
        count: 0,
        projects: [] as {
          projectId: string;
          projectTitle: string;
          divinityCoinRefunds: number;
          divinityCoinAmount: number;
          stripePledgesCancelled: number;
        }[],
      },
      totalDivinityCoinRefunds: 0,
      totalDivinityCoinAmount: 0,
      totalStripePledgesCancelled: 0,
    };

    // --- Process FUNDED projects (met goal, campaign ended) ---
    for (const project of fundedProjects) {
      try {
        // Atomic CAS on status: LIVE → FUNDED. Without this CAS, two
        // concurrent cron runs (overlap + slow first run) would both
        // findMany the same ended projects and both try to flip them —
        // the second would succeed (plain update) and fire the same
        // "FUNDED" notifications / clear prelaunch fields twice.
        const fundCas = await db.project.updateMany({
          where: { id: project.id, status: "LIVE", deletedAt: null },
          data: {
            status: "FUNDED",
            ...(project.fundedAt ? {} : { fundedAt: now }),
            // Clear prelaunch data - no longer needed once funded
            prelaunchActive: false,
            prelaunchDescription: null,
            prelaunchStatus: "DRAFT",
          },
        });

        if (fundCas.count === 0) {
          cronProcessFailedCampaignsLogger.info(`[Cron Ended Campaigns] "${project.title}" status already transitioned out of LIVE — skipping`);
          continue;
        }

        results.funded.count++;
        results.funded.projects.push({
          id: project.id,
          title: project.title,
          amount: Number(project.currentAmount),
        });

        cronProcessFailedCampaignsLogger.info(`[Cron Ended Campaigns] "${project.title}" → FUNDED ($${project.currentAmount}/$${project.goalAmount})`);
      } catch (error) {
        cronProcessFailedCampaignsLogger.error({ err: error }, `[Cron Ended Campaigns] Error transitioning project ${project.id} to FUNDED:`);
      }
    }

    // --- Process FAILED projects (didn't meet goal, campaign ended) ---
    for (const project of failedProjects) {
      try {
        // Atomic CAS on status: LIVE → FAILED before processing any
        // pledges. If a concurrent cron tick already started processing
        // this failed campaign, skip immediately — otherwise the
        // downstream refund loops would attempt to refund the same
        // pledges twice. (Each refund operation has its own guard via
        // `where: { status: "COMPLETED" }` on the pledge, but the DC
        // API call and notification fires at the project level aren't
        // similarly guarded.)
        const failCas = await db.project.updateMany({
          where: { id: project.id, status: "LIVE", deletedAt: null },
          data: { status: "FAILED" },
        });

        if (failCas.count === 0) {
          cronProcessFailedCampaignsLogger.info(`[Cron Ended Campaigns] "${project.title}" status already transitioned out of LIVE — skipping failed-campaign processing`);
          continue;
        }

        const projectResult = {
          projectId: project.id,
          projectTitle: project.title,
          divinityCoinRefunds: 0,
          divinityCoinAmount: 0,
          stripePledgesCancelled: 0,
          paypalAuthsCancelled: 0,
          whopPledgesCancelled: 0,
        };

        // Process DivinityCoin refunds
        if (project.paymentProcessor === "DIVINITYCOIN") {
          const refundResult = await refundDivinityCoinPledges(project.id, project.title);
          projectResult.divinityCoinRefunds = refundResult.count;
          projectResult.divinityCoinAmount = refundResult.totalAmount;
        }

        // Cancel Stripe pledges (they weren't charged since campaign wasn't funded)
        const stripeCancelResult = await cancelStripePledges(project.id);
        projectResult.stripePledgesCancelled = stripeCancelResult.count;

        // Void PayPal authorized pledges (authorization holds must be explicitly released)
        const paypalCancelResult = await cancelPaypalAuthorizedPledges(project.id);
        projectResult.paypalAuthsCancelled = paypalCancelResult.count;

        // Cancel Whop pending pledges
        const whopCancelResult = await cancelWhopPledges(project.id);
        projectResult.whopPledgesCancelled = whopCancelResult.count;

        // Note: project status was already flipped to FAILED via the
        // CAS at the top of this loop iteration — no-op now.

        results.failed.count++;
        results.failed.projects.push(projectResult);
        results.totalDivinityCoinRefunds += projectResult.divinityCoinRefunds;
        results.totalDivinityCoinAmount += projectResult.divinityCoinAmount;
        results.totalStripePledgesCancelled += projectResult.stripePledgesCancelled;

        cronProcessFailedCampaignsLogger.info(`[Cron Ended Campaigns] "${project.title}" → FAILED: ` +
          `${projectResult.divinityCoinRefunds} DC refunds ($${projectResult.divinityCoinAmount}), ` +
          `${projectResult.stripePledgesCancelled} Stripe pledges cancelled`);
      } catch (error) {
        cronProcessFailedCampaignsLogger.error({ err: error }, `[Cron Ended Campaigns] Error processing failed project ${project.id}:`);
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    cronProcessFailedCampaignsLogger.error({ err: String(error) }, "Process ended campaigns cron error:");
    return NextResponse.json(
      { error: "Failed to process ended campaigns" },
      { status: 500 }
    );
  }
}

/**
 * Refund DivinityCoin pledges for a failed project
 *
 * Calls DC's API to:
 * 1. Release any credit holds (for unfunded campaigns)
 * 2. Process Stripe refunds for card payments
 *
 * Only refunds pledges where:
 * - paymentProcessor = DIVINITYCOIN
 * - status = COMPLETED
 */
async function refundDivinityCoinPledges(projectId: string, projectTitle: string) {
  // Find all DivinityCoin pledges that need refunding
  const pledgesToRefund = await db.pledge.findMany({
    where: {
      projectId,
      paymentProcessor: "DIVINITYCOIN",
      status: "COMPLETED",
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
      amount: true,
      rewardId: true,
      divinityCoinPaymentId: true,
    },
  });

  let totalAmount = 0;

  for (const pledge of pledgesToRefund) {
    try {
      const amount = Number(pledge.amount);

      // Step 1: Call DC API to release hold + refund the Stripe charge
      const dcResult = await callDivinityCoinAPI("release", {
        pledgeId: pledge.id,
        paymentId: pledge.divinityCoinPaymentId,
        reason: "campaign_failed",
        refund: true, // Tell DC to also process the Stripe refund
      });

      if (!dcResult.success) {
        cronProcessFailedCampaignsLogger.error({ err: dcResult.error }, `[Cron Failed Campaigns] DC API release failed for pledge ${pledge.id}:`);
        // Continue processing other pledges even if one fails
      }

      // Step 2: Update local records
      await db.$transaction(async (tx) => {
        // Mark pledge as refunded
        await tx.pledge.update({
          where: { id: pledge.id },
          data: {
            status: "REFUNDED",
            lastFailureReason: "Campaign did not reach funding goal",
          },
        });

        // Decrement reward quantity if applicable
        if (pledge.rewardId) {
          await tx.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`;
        }

        // Create refund transaction record
        await tx.divinityCoinTransaction.create({
          data: {
            userId: pledge.userId,
            pledgeId: pledge.id,
            amount: -amount,
            type: "REFUND",
            description: `Refund for failed campaign "${projectTitle}"`,
            metadata: JSON.stringify({
              reason: "campaign_failed",
              projectId,
              originalPaymentId: pledge.divinityCoinPaymentId,
              dcReleaseResult: dcResult.data,
              timestamp: new Date().toISOString(),
            }),
          },
        });
      });

      totalAmount += amount;
    } catch (error) {
      cronProcessFailedCampaignsLogger.error({ err: error }, `[Cron Failed Campaigns] Error refunding pledge ${pledge.id}:`);
    }
  }

  return {
    count: pledgesToRefund.length,
    totalAmount,
  };
}

/**
 * Cancel Stripe pledges for a failed project
 *
 * Since these pledges were never charged (campaign wasn't funded),
 * we just need to mark them as cancelled
 */
async function cancelStripePledges(projectId: string) {
  // Find all pending Stripe pledges
  const pledgesToCancel = await db.pledge.findMany({
    where: {
      projectId,
      paymentProcessor: "STRIPE",
      status: "PENDING",
      chargedImmediately: false, // Pledges that weren't charged yet
      deletedAt: null,
    },
    select: {
      id: true,
      rewardId: true,
    },
  });

  for (const pledge of pledgesToCancel) {
    try {
      await db.$transaction(async (tx) => {
        // Mark pledge as cancelled
        await tx.pledge.update({
          where: { id: pledge.id },
          data: {
            status: "CANCELLED",
            lastFailureReason: "Campaign did not reach funding goal",
          },
        });

        // Decrement reward quantity if applicable
        if (pledge.rewardId) {
          await tx.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`;
        }
      });
    } catch (error) {
      cronProcessFailedCampaignsLogger.error({ err: error }, `[Cron Failed Campaigns] Error cancelling pledge ${pledge.id}:`);
    }
  }

  return {
    count: pledgesToCancel.length,
  };
}

async function cancelPaypalAuthorizedPledges(projectId: string) {
  // Find PayPal pledges with an authorization hold (backer authorized, campaign didn't fund)
  const pledges = await db.pledge.findMany({
    where: {
      projectId,
      paymentProcessor: "PAYPAL",
      status: "PENDING",
      paypalAuthorizationId: { not: null },
      deletedAt: null,
    },
    select: { id: true, rewardId: true, confirmationEmailSent: true, amount: true, paypalAuthorizationId: true },
  });

  let count = 0;
  try {
    const paypalConfig = await getPayPalConfig();
    const accessToken = await getPayPalAccessToken();

    for (const pledge of pledges) {
      try {
        // Void the PayPal authorization to release the hold on the backer's card
        const voidRes = await fetch(
          `${paypalConfig.baseUrl}/v2/payments/authorizations/${pledge.paypalAuthorizationId}/void`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (!voidRes.ok && voidRes.status !== 422) {
          // 422 means already voided/captured — treat as success
          cronProcessFailedCampaignsLogger.error(
            { pledgeId: pledge.id, status: voidRes.status },
            "[Cron Failed] Failed to void PayPal authorization"
          );
        }
      } catch (voidErr) {
        cronProcessFailedCampaignsLogger.error({ err: String(voidErr), pledgeId: pledge.id }, "[Cron Failed] Error voiding PayPal auth");
      }

      // Mark pledge cancelled and reverse stats if they were counted
      await db.$transaction(async (tx) => {
        await tx.pledge.update({
          where: { id: pledge.id },
          data: { status: "CANCELLED", lastFailureReason: "Campaign did not reach funding goal" },
        });

        if (pledge.confirmationEmailSent) {
          await tx.project.update({
            where: { id: projectId },
            data: {
              backerCount: { decrement: 1 },
              currentAmount: { decrement: Number(pledge.amount) },
            },
          });
        }

        if (pledge.rewardId) {
          await tx.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`;
        }
      });

      count++;
    }
  } catch (err) {
    cronProcessFailedCampaignsLogger.error({ err: String(err) }, "[Cron Failed] Error in cancelPaypalAuthorizedPledges");
  }

  return { count };
}

async function cancelWhopPledges(projectId: string) {
  const pledges = await db.pledge.findMany({
    where: {
      projectId,
      paymentProcessor: "WHOP",
      status: "PENDING",
      deletedAt: null,
    },
    select: { id: true, rewardId: true, confirmationEmailSent: true, amount: true },
  });

  for (const pledge of pledges) {
    try {
      await db.$transaction(async (tx) => {
        await tx.pledge.update({
          where: { id: pledge.id },
          data: { status: "CANCELLED", lastFailureReason: "Campaign did not reach funding goal" },
        });

        if (pledge.confirmationEmailSent) {
          await tx.project.update({
            where: { id: projectId },
            data: {
              backerCount: { decrement: 1 },
              currentAmount: { decrement: Number(pledge.amount) },
            },
          });
        }

        if (pledge.rewardId) {
          await tx.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`;
        }
      });
    } catch (err) {
      cronProcessFailedCampaignsLogger.error({ err: String(err), pledgeId: pledge.id }, "[Cron Failed] Error cancelling Whop pledge");
    }
  }

  return { count: pledges.length };
}

// Also support POST for flexibility
export async function POST(req: NextRequest) {
  return GET(req);
}
