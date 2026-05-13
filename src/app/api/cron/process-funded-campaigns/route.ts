import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const cronProcessFundedCampaignsLogger = logger.child({ module: "cron-process-funded-campaigns" });
import { db } from "@/lib/db";
import { processPendingPledgesForProject, getStripeInstance } from "@/lib/payments/stripe";
import { captureAuthorizedPaypalPledges } from "@/lib/payments/paypal";
import { chargeDcSavedPaymentMethod } from "@/lib/payments/divinitycoin";

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

/**
 * Sync payment methods from Stripe for pledges that have SetupIntents
 * but are missing payment method IDs (e.g., webhook failed)
 *
 * SAFETY: Only syncs for PENDING pledges - cancelled pledges are skipped
 */
async function syncPaymentMethodsFromStripe(projectId: string) {
  const stripe = await getStripeInstance();

  // Find pending pledges with SetupIntent but no payment method
  // CRITICAL: Only sync for PENDING status - never for CANCELLED/FAILED/etc
  // Prisma 7 rejects `{ field: { not: null } }` on nullable string fields at
  // runtime — use the `NOT: { field: null }` wrapper syntax instead.
  const pledgesNeedingSync = await db.pledge.findMany({
    where: {
      projectId,
      status: "PENDING", // SAFETY: Only PENDING pledges
      deletedAt: null,
      NOT: { stripeSetupIntentId: null },
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
      // SAFETY: Re-verify pledge is still PENDING before syncing
      const currentPledge = await db.pledge.findFirst({
        where: { id: pledge.id, deletedAt: null },
        select: { status: true },
      });

      if (currentPledge?.status !== "PENDING") {
        cronProcessFundedCampaignsLogger.info(`[Cron Sync] Skipping pledge ${pledge.id} - status changed to ${currentPledge?.status}`);
        continue;
      }

      const setupIntent = await stripe.setupIntents.retrieve(pledge.stripeSetupIntentId!);

      // SAFETY: Only sync if SetupIntent succeeded AND wasn't cancelled
      if (setupIntent.status === "succeeded" && setupIntent.payment_method) {
        const paymentMethodId = typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method.id;

        // SAFETY: Double-check the payment method is still attached/valid
        try {
          const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
          if (!pm.customer) {
            cronProcessFundedCampaignsLogger.info(`[Cron Sync] Skipping pledge ${pledge.id} - payment method ${paymentMethodId} is detached`);
            continue;
          }
        } catch {
          cronProcessFundedCampaignsLogger.info(`[Cron Sync] Skipping pledge ${pledge.id} - payment method ${paymentMethodId} not found`);
          continue;
        }

        await db.pledge.update({
          where: { id: pledge.id },
          data: { stripePaymentMethodId: paymentMethodId },
        });
        synced++;
      } else if (setupIntent.status === "canceled") {
        cronProcessFundedCampaignsLogger.info(`[Cron Sync] SetupIntent ${pledge.stripeSetupIntentId} was cancelled - skipping`);
      }
    } catch (error) {
      cronProcessFundedCampaignsLogger.warn({ data: error }, `[Cron Sync] Error syncing pledge ${pledge.id}:`);
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
        // Only active/published projects (LIVE = running campaign, FUNDED = reached goal)
        status: { in: ["LIVE", "FUNDED"] },
        deletedAt: null,
        // Campaign must be funded (currentAmount >= goalAmount)
        // Using raw query comparison since Prisma doesn't support field comparison directly
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
                // Either a Stripe payment method (legacy/Stripe campaigns)
                // or a DC saved pm (DivinityCoin AoN saved-card flow) —
                // anything we can actually charge.
                OR: [
                  { NOT: { stripePaymentMethodId: null } },
                  { NOT: { divinityCoinPaymentMethodId: null } },
                ],
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
      }[],
      totalPledgesProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
    };

    // Also find projects that might have pledges needing payment method sync
    const projectsNeedingSync = fundedProjectsWithPendingPledges.filter(
      (project) => Number(project.currentAmount) >= Number(project.goalAmount)
    );

    // Check if Stripe is enabled before attempting any Stripe operations
    const stripeSettings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { stripeEnabled: true },
    });
    const stripeEnabled = stripeSettings?.stripeEnabled ?? false;

    let totalSynced = 0;

    // First pass: sync payment methods from Stripe for all funded projects
    for (const project of projectsNeedingSync) {
      if (!stripeEnabled) break;
      const synced = await syncPaymentMethodsFromStripe(project.id);
      totalSynced += synced;
      if (synced > 0) {
        cronProcessFundedCampaignsLogger.info(`[Cron] Synced ${synced} payment methods for "${project.title}"`);
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
                OR: [
                  { NOT: { stripePaymentMethodId: null } },
                  { NOT: { divinityCoinPaymentMethodId: null } },
                ],
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
        // Only charge via Stripe if Stripe is enabled
        const stripeResults = stripeEnabled
          ? await processPendingPledgesForProject(project.id)
          : { total: 0, successful: 0, failed: 0 };

        // Always capture authorized PayPal pledges (independent of Stripe)
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

        const pledgeResults = {
          total: stripeResults.total + dcResults.total,
          successful: stripeResults.successful + dcResults.successful,
          failed: stripeResults.failed + dcResults.failed,
        };

        results.processed.push({
          projectId: project.id,
          projectTitle: project.title,
          ...pledgeResults,
        });

        results.totalPledgesProcessed += pledgeResults.total;
        results.totalSuccessful += pledgeResults.successful;
        results.totalFailed += pledgeResults.failed;

        cronProcessFundedCampaignsLogger.info(`[Cron] Processed funded campaign "${project.title}": ${pledgeResults.successful}/${pledgeResults.total} pledges charged`);
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
      totalPaymentMethodsSynced: totalSynced,
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
