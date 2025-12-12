import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processPendingPledgesForProject, getStripeInstance } from "@/lib/payments/stripe";

/**
 * Sync payment methods from Stripe for pledges that have SetupIntents
 * but are missing payment method IDs (e.g., webhook failed)
 */
async function syncPaymentMethodsFromStripe(projectId: string) {
  const stripe = await getStripeInstance();

  // Find pending pledges with SetupIntent but no payment method
  const pledgesNeedingSync = await db.pledge.findMany({
    where: {
      projectId,
      status: "PENDING",
      stripeSetupIntentId: { not: null },
      stripePaymentMethodId: null,
    },
    select: {
      id: true,
      stripeSetupIntentId: true,
    },
  });

  let synced = 0;
  for (const pledge of pledgesNeedingSync) {
    try {
      const setupIntent = await stripe.setupIntents.retrieve(pledge.stripeSetupIntentId!);
      if (setupIntent.status === "succeeded" && setupIntent.payment_method) {
        const paymentMethodId = typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method.id;

        await db.pledge.update({
          where: { id: pledge.id },
          data: { stripePaymentMethodId: paymentMethodId },
        });
        synced++;
      }
    } catch {
      // Ignore errors - will be retried next cron run
    }
  }

  return synced;
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

    // Allow if no secret is configured (dev mode) or if secret matches
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find funded projects that have pending pledges waiting to be charged
    // A project is "funded" when currentAmount >= goalAmount
    const fundedProjectsWithPendingPledges = await db.project.findMany({
      where: {
        // Only active/published projects
        status: { in: ["ACTIVE", "APPROVED"] },
        // Campaign must be funded (currentAmount >= goalAmount)
        // Using raw query comparison since Prisma doesn't support field comparison directly
      },
      select: {
        id: true,
        title: true,
        currentAmount: true,
        goalAmount: true,
        _count: {
          select: {
            pledges: {
              where: {
                status: "PENDING",
                chargedImmediately: false,
                stripePaymentMethodId: { not: null },
              },
            },
          },
        },
      },
    });

    // Filter to only projects that are actually funded and have pending pledges
    const projectsToProcess = fundedProjectsWithPendingPledges.filter(
      (project) =>
        project.currentAmount >= project.goalAmount &&
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
      }[],
      totalPledgesProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
    };

    // Also find projects that might have pledges needing payment method sync
    const projectsNeedingSync = fundedProjectsWithPendingPledges.filter(
      (project) => project.currentAmount >= project.goalAmount
    );

    let totalSynced = 0;

    // First pass: sync payment methods from Stripe for all funded projects
    for (const project of projectsNeedingSync) {
      const synced = await syncPaymentMethodsFromStripe(project.id);
      totalSynced += synced;
      if (synced > 0) {
        console.log(`[Cron] Synced ${synced} payment methods for "${project.title}"`);
      }
    }

    // Re-query to get updated counts after sync
    const projectsToProcessAfterSync = await db.project.findMany({
      where: {
        id: { in: projectsNeedingSync.map(p => p.id) },
      },
      select: {
        id: true,
        title: true,
        _count: {
          select: {
            pledges: {
              where: {
                status: "PENDING",
                chargedImmediately: false,
                stripePaymentMethodId: { not: null },
              },
            },
          },
        },
      },
    });

    const projectsReadyToCharge = projectsToProcessAfterSync.filter(p => p._count.pledges > 0);

    // Process pending pledges for each funded project
    for (const project of projectsReadyToCharge) {
      try {
        const pledgeResults = await processPendingPledgesForProject(project.id);

        results.processed.push({
          projectId: project.id,
          projectTitle: project.title,
          ...pledgeResults,
        });

        results.totalPledgesProcessed += pledgeResults.total;
        results.totalSuccessful += pledgeResults.successful;
        results.totalFailed += pledgeResults.failed;

        console.log(
          `[Cron] Processed funded campaign "${project.title}": ${pledgeResults.successful}/${pledgeResults.total} pledges charged`
        );
      } catch (error) {
        console.error(
          `[Cron] Error processing pledges for project ${project.id}:`,
          error
        );
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
      totalPaymentMethodsSynced: totalSynced,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Process funded campaigns cron error:", error);
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
