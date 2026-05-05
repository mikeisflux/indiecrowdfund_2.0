import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const cronProcessFundedCampaignsLogger = logger.child({ module: "cron-process-funded-campaigns" });
import { db } from "@/lib/db";
import { processPendingPledgesForProject, getStripeInstance } from "@/lib/payments/stripe";
import { captureAuthorizedPaypalPledges } from "@/lib/payments/paypal";
import { loadNmiConfig, saleByVaultToken } from "@/lib/nmi";
import { evaluateAutoTrigger } from "@/lib/payments/rolling-reserve";

// After NMI pledges have been charged for a funded project, evaluate
// whether the project should be flagged for the PaymentCloud rolling
// reserve. Auto-fires when effective revenue >= $2,500. Idempotent:
// re-running on an already-flagged project preserves heldAt/releaseAt.
async function evaluateProjectRollingReserve(projectId: string): Promise<void> {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      paymentProcessor: true,
      currentAmount: true,
      rollingReserveSubject: true,
      rollingReserveAuto: true,
      rollingReserveAmount: true,
      rollingReserveHeldAt: true,
      rollingReserveReleaseAt: true,
      rollingReserveReleased: true,
    },
  });
  if (!project || project.paymentProcessor !== "NMI") return;
  if (project.rollingReserveReleased) return;
  const effectiveRevenue = Number(project.currentAmount);
  const next = evaluateAutoTrigger(
    {
      paymentProcessor: project.paymentProcessor,
      rollingReserveSubject: project.rollingReserveSubject,
      rollingReserveAuto: project.rollingReserveAuto,
      rollingReserveAmount: Number(project.rollingReserveAmount),
      rollingReserveHeldAt: project.rollingReserveHeldAt,
      rollingReserveReleaseAt: project.rollingReserveReleaseAt,
    },
    effectiveRevenue
  );
  // Only write if something changed.
  if (
    next.rollingReserveAuto === project.rollingReserveAuto &&
    Math.abs(next.rollingReserveAmount - Number(project.rollingReserveAmount)) < 0.005 &&
    next.rollingReserveHeldAt?.getTime() === project.rollingReserveHeldAt?.getTime()
  ) {
    return;
  }
  await db.project.update({
    where: { id: projectId },
    data: {
      rollingReserveAuto: next.rollingReserveAuto,
      rollingReserveAmount: next.rollingReserveAmount,
      rollingReserveHeldAt: next.rollingReserveHeldAt ?? undefined,
      rollingReserveReleaseAt: next.rollingReserveReleaseAt ?? undefined,
    },
  });
}

// Charge all PENDING NMI pledges for a project that has hit its goal.
// Pattern is claim-then-process to avoid double-charges if two cron
// runs overlap (the schedule is every 5 minutes; one slow run can
// still be in flight when the next fires):
//   1. CAS-flip chargedImmediately false→true while still PENDING.
//      Only the request that wins the CAS owns this pledge for this
//      cycle; concurrent runs see chargedImmediately=true and skip.
//   2. Run the sale with the won pledge.
//   3. On success → mark COMPLETED with the transaction id.
//      On decline → mark FAILED + restore chargedImmediately=false so
//      a future cron / admin retry can try again with a different card.
async function captureNmiPendingPledges(projectId: string): Promise<{
  total: number;
  successful: number;
  failed: number;
}> {
  const result = { total: 0, successful: 0, failed: 0 };
  const config = await loadNmiConfig();
  if (!config) return result;

  const pledges = await db.pledge.findMany({
    where: {
      projectId,
      status: "PENDING",
      paymentProcessor: "NMI",
      chargedImmediately: false,
      deletedAt: null,
      NOT: { nmiCustomerVaultId: null },
      // Honour the retry schedule: skip any pledge that's been put
      // on a backoff window by a prior failure.
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: new Date() } },
      ],
    },
    select: {
      id: true,
      amount: true,
      nmiCustomerVaultId: true,
      nmiInitialTransactionId: true,
      retryCount: true,
      project: { select: { title: true } },
      user: { select: { email: true } },
    },
  });

  // Cap auto-retries at 5 with exponential-ish backoff (1h, 6h, 24h,
  // 72h, 168h). Past the cap a pledge is marked FAILED for an admin
  // to look at — better than retrying a perma-declining card forever.
  const MAX_NMI_RETRIES = 5;
  const BACKOFF_HOURS = [1, 6, 24, 72, 168];

  result.total = pledges.length;
  for (const p of pledges) {
    if (!p.nmiCustomerVaultId) continue;

    // Atomic claim. If a concurrent worker already flipped
    // chargedImmediately to true (or the pledge already has a
    // transaction id), we skip — they own the charge.
    const claimed = await db.pledge.updateMany({
      where: {
        id: p.id,
        status: "PENDING",
        chargedImmediately: false,
        nmiTransactionId: null,
        deletedAt: null,
      },
      data: { chargedImmediately: true },
    });
    if (claimed.count === 0) {
      cronProcessFundedCampaignsLogger.info(
        { pledgeId: p.id },
        "[Cron] NMI pledge already claimed by a concurrent worker; skipping"
      );
      continue;
    }

    try {
      // Tag this as MIT (merchant-initiated) — the cardholder isn't
      // present at the time of charge. If we already have an
      // initial_transaction_id from a prior charge on this vault
      // entry, mark stored_credential_indicator="used"; otherwise
      // this IS the first charge so it's "stored".
      const hasInitial = !!p.nmiInitialTransactionId;
      const sale = await saleByVaultToken(config, {
        amount: Number(p.amount),
        customerVaultId: p.nmiCustomerVaultId,
        orderid: p.id,
        orderdescription: `Pledge to ${p.project.title}`,
        email: p.user.email || undefined,
        initiatedBy: "merchant",
        storedCredentialIndicator: hasInitial ? "used" : "stored",
        initialTransactionId: p.nmiInitialTransactionId || undefined,
      });
      if (sale.response === "1" && sale.transactionid) {
        await db.pledge.update({
          where: { id: p.id },
          data: {
            status: "COMPLETED",
            nmiTransactionId: sale.transactionid,
            // Only persist the initial transaction id on the first
            // successful sale. Subsequent retries already have it
            // set and shouldn't overwrite.
            ...(hasInitial ? {} : { nmiInitialTransactionId: sale.transactionid }),
            retryCount: 0,
            nextRetryAt: null,
          },
        });
        result.successful++;
      } else {
        // Decline. Within the retry budget, schedule another attempt
        // and roll back the claim. Past the cap, mark FAILED so an
        // admin notices.
        const newRetryCount = (p.retryCount || 0) + 1;
        if (newRetryCount >= MAX_NMI_RETRIES) {
          await db.pledge.update({
            where: { id: p.id },
            data: {
              status: "FAILED",
              chargedImmediately: false,
              retryCount: newRetryCount,
              nextRetryAt: null,
              lastFailureReason: `${sale.responsetext || "Mentom Payments declined"} (after ${newRetryCount} attempts)`,
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
              lastFailureReason: sale.responsetext || "Mentom Payments declined",
            },
          });
        }
        result.failed++;
      }
    } catch (err) {
      cronProcessFundedCampaignsLogger.error(
        { err: err instanceof Error ? err.message : String(err), pledgeId: p.id },
        "[Cron] NMI charge error"
      );
      // Network/HTTP error — uncertain whether NMI captured. Don't
      // mark FAILED (they might have actually charged); roll back the
      // claim and schedule a retry on the next backoff window.
      const newRetryCount = (p.retryCount || 0) + 1;
      const backoffHours =
        BACKOFF_HOURS[Math.min(newRetryCount - 1, BACKOFF_HOURS.length - 1)];
      const nextRetryAt = new Date(Date.now() + backoffHours * 60 * 60 * 1000);
      await db.pledge
        .updateMany({
          where: { id: p.id, status: "PENDING", nmiTransactionId: null },
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
                // or a PaymentCloud vault id (NMI campaigns) — anything we
                // can actually charge.
                OR: [
                  { NOT: { stripePaymentMethodId: null } },
                  { NOT: { nmiCustomerVaultId: null } },
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
                  { NOT: { nmiCustomerVaultId: null } },
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

        // Charge any PENDING PaymentCloud (NMI) vault tokens. AoN campaigns
        // tokenize at pledge time and defer the actual sale to here.
        const nmiResults = await captureNmiPendingPledges(project.id).catch((err) => {
          cronProcessFundedCampaignsLogger.error(
            { err: String(err) },
            `[Cron] NMI capture error for project ${project.id}`
          );
          return { total: 0, successful: 0, failed: 0 };
        });

        const pledgeResults = {
          total: stripeResults.total + nmiResults.total,
          successful: stripeResults.successful + nmiResults.successful,
          failed: stripeResults.failed + nmiResults.failed,
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

        // PaymentCloud rolling reserve auto-trigger. Best-effort — a
        // failure to flag here doesn't block the payout calculation,
        // which also re-checks the trigger at GET time.
        await evaluateProjectRollingReserve(project.id).catch((err) =>
          cronProcessFundedCampaignsLogger.error(
            { err: String(err), projectId: project.id },
            "[Cron] Rolling reserve auto-trigger error"
          )
        );
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
