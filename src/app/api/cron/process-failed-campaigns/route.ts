import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const cronProcessFailedCampaignsLogger = logger.child({ module: "cron-process-failed-campaigns" });
import { db } from "@/lib/db";
import { windDownProject, meetsMinimumFunding, MIN_FUNDING_RATIO } from "@/lib/projects/wind-down";
import { distributeReadyFilesForProject } from "@/lib/fulfillment/auto-distribute";

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
    // Funded: All-or-Nothing at/over goal, or Keep-It-All at/over the
    // minimum funding ratio (Terms §6). Anything else is refunded — a
    // Keep-It-All campaign that ends far below its goal used to be paid
    // out as "funded", and at that level processing, payout and
    // fulfilment support cost more than it raised.
    const isFunded = (project: { campaignType: string; currentAmount: unknown; goalAmount: unknown }) =>
      project.campaignType === "KEEP_IT_ALL"
        ? meetsMinimumFunding(project.currentAmount, project.goalAmount)
        : Number(project.currentAmount) >= Number(project.goalAmount);
    const fundedProjects = endedProjects.filter(isFunded);
    const failedProjects = endedProjects.filter((p) => !isFunded(p));

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

        // Campaign just closed: the LIVE lock gate has lifted, so push any
        // already-processed distribution rules to every backer who now
        // qualifies (not just those who locked during the campaign). Backers
        // still awaiting their post-close charge are picked up on the next
        // process-funded-campaigns pass once they complete.
        await distributeReadyFilesForProject(project.id).catch((err) =>
          cronProcessFailedCampaignsLogger.error({ err: String(err) }, `[Cron Ended Campaigns] auto-distribute on close failed for ${project.id}`)
        );
      } catch (error) {
        cronProcessFailedCampaignsLogger.error({ err: error }, `[Cron Ended Campaigns] Error transitioning project ${project.id} to FUNDED:`);
      }
    }

    // --- Process FAILED projects (campaign ended, not funded) ---
    for (const project of failedProjects) {
      try {
        const underMinimum =
          project.campaignType === "KEEP_IT_ALL" ||
          !meetsMinimumFunding(project.currentAmount, project.goalAmount);
        const r = await windDownProject({
          projectId: project.id,
          cause: underMinimum ? "under-minimum" : "not-funded",
          outcome: "FAILED",
        });
        if (r.outcome === "skipped") {
          cronProcessFailedCampaignsLogger.info(`[Cron Ended Campaigns] "${project.title}" skipped: ${r.skippedReason}`);
          continue;
        }
        results.failed.count++;
        results.failed.projects.push({
          projectId: project.id,
          projectTitle: project.title,
          divinityCoinRefunds: r.dcRefunded,
          divinityCoinAmount: r.dcRefundedAmount,
          stripePledgesCancelled: r.stripeCancelled,
        });
        results.totalDivinityCoinRefunds += r.dcRefunded;
        results.totalDivinityCoinAmount += r.dcRefundedAmount;
        results.totalStripePledgesCancelled += r.stripeCancelled;
        cronProcessFailedCampaignsLogger.info(
          `[Cron Ended Campaigns] "${project.title}" → FAILED (${underMinimum ? `under ${Math.round(MIN_FUNDING_RATIO * 100)}% of goal` : "goal not met"}): ` +
            `${r.dcRefunded} DC refunds ($${r.dcRefundedAmount}), ${r.dcRefundFailed} failed, ${r.whopNeedsManualRefund} Whop need manual reversal`
        );
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
    cronProcessFailedCampaignsLogger.error({ err: formatError(error) }, "Process ended campaigns cron error:");
    return NextResponse.json(
      { error: "Failed to process ended campaigns" },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(req: NextRequest) {
  return GET(req);
}
