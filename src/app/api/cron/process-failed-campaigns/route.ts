import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";

/**
 * Cron job endpoint for processing failed campaigns
 *
 * This handles campaigns that have ended without reaching their funding goal:
 * - Refunds DivinityCoin pledges to backers
 * - Updates project status to FAILED
 * - Marks pledges as REFUNDED
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

    // Allow if no secret is configured (dev mode) or if secret matches
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();

    // Find LIVE projects that have ended without reaching their goal
    // endDate has passed AND currentAmount < goalAmount
    const failedProjects = await db.project.findMany({
      where: {
        status: "LIVE",
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
      },
    });

    // Filter to only projects that actually failed (didn't reach goal)
    const projectsToProcess = failedProjects.filter(
      (project) => Number(project.currentAmount) < Number(project.goalAmount)
    );

    const results = {
      projectsChecked: failedProjects.length,
      projectsToProcess: projectsToProcess.length,
      processed: [] as {
        projectId: string;
        projectTitle: string;
        divinityCoinRefunds: number;
        divinityCoinAmount: number;
        stripePledgesCancelled: number;
      }[],
      totalDivinityCoinRefunds: 0,
      totalDivinityCoinAmount: 0,
      totalStripePledgesCancelled: 0,
    };

    for (const project of projectsToProcess) {
      try {
        const projectResult = {
          projectId: project.id,
          projectTitle: project.title,
          divinityCoinRefunds: 0,
          divinityCoinAmount: 0,
          stripePledgesCancelled: 0,
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

        // Update project status to FAILED
        await db.project.update({
          where: { id: project.id },
          data: {
            status: "FAILED",
          },
        });

        results.processed.push(projectResult);
        results.totalDivinityCoinRefunds += projectResult.divinityCoinRefunds;
        results.totalDivinityCoinAmount += projectResult.divinityCoinAmount;
        results.totalStripePledgesCancelled += projectResult.stripePledgesCancelled;

        console.log(
          `[Cron Failed Campaigns] Processed "${project.title}": ` +
          `${projectResult.divinityCoinRefunds} DivinityCoin refunds ($${projectResult.divinityCoinAmount}), ` +
          `${projectResult.stripePledgesCancelled} Stripe pledges cancelled`
        );
      } catch (error) {
        console.error(
          `[Cron Failed Campaigns] Error processing project ${project.id}:`,
          error
        );
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Process failed campaigns cron error:", error);
    return NextResponse.json(
      { error: "Failed to process failed campaigns" },
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
        console.error(
          `[Cron Failed Campaigns] DC API release failed for pledge ${pledge.id}:`,
          dcResult.error
        );
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
          await tx.reward.update({
            where: { id: pledge.rewardId },
            data: {
              quantityClaimed: { decrement: 1 },
            },
          });
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
      console.error(
        `[Cron Failed Campaigns] Error refunding pledge ${pledge.id}:`,
        error
      );
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
          await tx.reward.update({
            where: { id: pledge.rewardId },
            data: {
              quantityClaimed: { decrement: 1 },
            },
          });
        }
      });
    } catch (error) {
      console.error(
        `[Cron Failed Campaigns] Error cancelling pledge ${pledge.id}:`,
        error
      );
    }
  }

  return {
    count: pledgesToCancel.length,
  };
}

// Also support POST for flexibility
export async function POST(req: NextRequest) {
  return GET(req);
}
