import Stripe from "stripe";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { circuitBreaker } from "@/lib/circuit-breaker";
import { metrics } from "@/lib/metrics";
import {
  notifyPledgeFailed,
  notifyBackerPledgeConfirmed,
} from "@/lib/notifications";
import { getStripeInstance } from "./config";
import { trackCampaignConversion, assignBackerNumber } from "./rewards";

const stripeLogger = logger.child({ module: "stripe-charges" });

// Retry configuration: 3 attempts, every 3 days
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_INTERVAL_DAYS = 3;

/**
 * Charge a pledge that was saved via SetupIntent
 * Called when campaign reaches its funding goal
 *
 * DUPLICATE CHARGE PREVENTION:
 * - Uses Stripe idempotency keys based on pledgeId
 * - Checks for existing PaymentIntent before creating
 * - Atomic status check before charging
 */
export async function chargeSavedPledge(pledgeId: string): Promise<boolean> {
  const stripeClient = await getStripeInstance();

  // Fetch platform fee rate alongside the pledge
  const [pledge, platformSettings] = await Promise.all([
    db.pledge.findFirst({
    where: { id: pledgeId , deletedAt: null },
      include: {
        project: {
          include: {
            creator: {
              include: {
                stripeConfig: true,
              },
            },
          },
        },
      },
    }),
    db.platformSettings.findUnique({
      where: { id: "default" },
      select: { platformFee: true },
    }).catch(() => null),
  ]);

  const platformFeeRate = platformSettings?.platformFee
    ? Number(platformSettings.platformFee) / 100
    : 0.03; // default 3%

  if (!pledge) {
    throw new Error("Pledge not found");
  }

  // SAFETY: Skip if already processed
  if (pledge.status !== "PENDING") {
    stripeLogger.info({ pledgeId, status: pledge.status }, "Pledge already processed - skipping");
    return false;
  }

  // SAFETY: If this pledge already has a PaymentIntent, check its status instead of creating new one
  if (pledge.stripePaymentIntentId) {
    try {
      const existingIntent = await circuitBreaker.execute("stripe", () =>
        stripeClient.paymentIntents.retrieve(pledge.stripePaymentIntentId!)
      );

      if (existingIntent.status === "succeeded") {
        stripeLogger.info({ pledgeId, paymentIntentId: pledge.stripePaymentIntentId }, "PaymentIntent already succeeded - updating pledge");
        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            status: "COMPLETED",
            retryCount: 0,
            nextRetryAt: null,
            lastFailureReason: null,
          },
        });
        if (pledge.sourceCampaignId) {
          await trackCampaignConversion(pledgeId, pledge.sourceCampaignId);
        }
        metrics.pledgesCreated.inc({ status: "completed" });
        return true;
      } else if (existingIntent.status === "processing") {
        stripeLogger.info({ pledgeId, paymentIntentId: pledge.stripePaymentIntentId }, "PaymentIntent is processing - skipping");
        return false;
      } else if (existingIntent.status === "canceled" || existingIntent.status === "requires_payment_method") {
        stripeLogger.info({ pledgeId, paymentIntentId: pledge.stripePaymentIntentId, status: existingIntent.status }, "PaymentIntent failed/canceled - will create new one");
        await db.pledge.update({
          where: { id: pledgeId },
          data: { stripePaymentIntentId: null },
        });
      } else if (existingIntent.status === "requires_action") {
        stripeLogger.info({ pledgeId, paymentIntentId: pledge.stripePaymentIntentId }, "PaymentIntent requires action - skipping");
        return false;
      } else if (existingIntent.status === "requires_confirmation") {
        try {
          const confirmedIntent = await circuitBreaker.execute("stripe", () =>
            stripeClient.paymentIntents.confirm(pledge.stripePaymentIntentId!)
          );
          if (confirmedIntent.status === "succeeded") {
            await db.pledge.update({
              where: { id: pledgeId },
              data: {
                status: "COMPLETED",
                retryCount: 0,
                nextRetryAt: null,
                lastFailureReason: null,
              },
            });
            if (pledge.sourceCampaignId) {
              await trackCampaignConversion(pledgeId, pledge.sourceCampaignId);
            }
            metrics.pledgesCreated.inc({ status: "completed" });
            return true;
          }
        } catch {
          stripeLogger.info({ pledgeId, paymentIntentId: pledge.stripePaymentIntentId }, "Failed to confirm PaymentIntent - will create new one");
          await db.pledge.update({
            where: { id: pledgeId },
            data: { stripePaymentIntentId: null },
          });
        }
      } else {
        stripeLogger.info({ pledgeId, paymentIntentId: pledge.stripePaymentIntentId, status: existingIntent.status }, "PaymentIntent has unknown status - skipping");
        return false;
      }
    } catch {
      stripeLogger.info({ pledgeId, paymentIntentId: pledge.stripePaymentIntentId }, "Could not retrieve PaymentIntent - will create new one");
      await db.pledge.update({
        where: { id: pledgeId },
        data: { stripePaymentIntentId: null },
      });
    }
  }

  if (!pledge.stripePaymentMethodId || !pledge.stripeCustomerId) {
    await db.pledge.update({
      where: { id: pledgeId },
      data: {
        status: "FAILED",
        lastFailureReason: "No saved payment method",
      },
    });
    metrics.paymentFailures.inc({ reason: "no_payment_method" });
    return false;
  }

  // CRITICAL SAFETY CHECK: Verify payment method is still attached to customer
  try {
    const paymentMethod = await circuitBreaker.execute("stripe", () =>
      stripeClient.paymentMethods.retrieve(pledge.stripePaymentMethodId!)
    );
    if (!paymentMethod.customer) {
      stripeLogger.info({ pledgeId, paymentMethodId: pledge.stripePaymentMethodId }, "Payment method is detached - skipping charge");
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "CANCELLED",
          lastFailureReason: "Payment method was detached (likely cancelled by admin)",
          stripePaymentMethodId: null,
        },
      });
      return false;
    }
    if (paymentMethod.customer !== pledge.stripeCustomerId) {
      stripeLogger.info({ pledgeId, paymentMethodId: pledge.stripePaymentMethodId }, "Payment method attached to wrong customer - skipping");
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "FAILED",
          lastFailureReason: "Payment method attached to different customer",
        },
      });
      metrics.paymentFailures.inc({ reason: "wrong_customer" });
      return false;
    }
  } catch {
    stripeLogger.info({ pledgeId, paymentMethodId: pledge.stripePaymentMethodId }, "Could not retrieve payment method - marking as cancelled");
    await db.pledge.update({
      where: { id: pledgeId },
      data: {
        status: "CANCELLED",
        lastFailureReason: "Payment method not found (likely cancelled by admin)",
        stripePaymentMethodId: null,
      },
    });
    return false;
  }

  // SAFETY: Re-verify pledge status right before charging (prevents race conditions)
  const freshPledge = await db.pledge.findFirst({
    where: { id: pledgeId , deletedAt: null },
    select: { status: true, stripePaymentMethodId: true },
  });
  if (freshPledge?.status !== "PENDING" || !freshPledge.stripePaymentMethodId) {
    stripeLogger.info({ pledgeId, status: freshPledge?.status }, "Pledge status changed before charge - skipping");
    return false;
  }

  const connectedAccountId = pledge.project.creator.stripeConfig?.stripeAccountId;
  if (!connectedAccountId) {
    throw new Error("Creator has not connected Stripe");
  }

  const amountInCents = Math.round(Number(pledge.amount) * 100);
  const platformFee = Math.round(Number(pledge.amount) * platformFeeRate * 100);

  try {
    const idempotencyKey = `charge_pledge_${pledgeId}_v${pledge.retryCount}`;

    const startTime = Date.now();
    const paymentIntent = await circuitBreaker.execute("stripe", () =>
      stripeClient.paymentIntents.create(
        {
          amount: amountInCents,
          currency: "usd",
          customer: pledge.stripeCustomerId!,
          payment_method: pledge.stripePaymentMethodId!,
          off_session: true,
          confirm: true,
          application_fee_amount: platformFee,
          transfer_data: {
            destination: connectedAccountId,
          },
          metadata: {
            pledgeId: pledge.id,
            projectId: pledge.projectId,
            userId: pledge.userId,
            chargeType: "campaign_funded",
          },
        },
        {
          idempotencyKey,
        }
      )
    );
    const durationSec = (Date.now() - startTime) / 1000;
    metrics.externalApiCalls.inc({ service: "stripe", method: "paymentIntents.create" });
    metrics.externalApiDuration.observe({ service: "stripe", method: "paymentIntents.create" }, durationSec);

    if (paymentIntent.status === "succeeded") {
      let finalBackerNumber: number;
      if (pledge.backerNumber) {
        finalBackerNumber = pledge.backerNumber;
        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            stripePaymentIntentId: paymentIntent.id,
            status: "COMPLETED",
            retryCount: 0,
            nextRetryAt: null,
            lastFailureReason: null,
          },
        });
      } else {
        finalBackerNumber = await assignBackerNumber(pledge.projectId, pledgeId);
        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            stripePaymentIntentId: paymentIntent.id,
            status: "COMPLETED",
            retryCount: 0,
            nextRetryAt: null,
            lastFailureReason: null,
          },
        });
      }

      if (pledge.sourceCampaignId) {
        await trackCampaignConversion(pledgeId, pledge.sourceCampaignId);
      }

      try {
        await notifyBackerPledgeConfirmed(pledgeId, true);
      } catch (e) {
        stripeLogger.warn({ pledgeId, err: e instanceof Error ? e.message : String(e) }, "Could not send confirmation email");
      }

      metrics.pledgesCreated.inc({ status: "completed" });
      stripeLogger.info({ pledgeId, backerNumber: finalBackerNumber }, "Payment succeeded, status updated to COMPLETED");
    } else if (paymentIntent.status === "processing") {
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          stripePaymentIntentId: paymentIntent.id,
        },
      });
      stripeLogger.info({ pledgeId }, "Payment processing, waiting for webhook");
    } else {
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          stripePaymentIntentId: paymentIntent.id,
        },
      });
      stripeLogger.warn({ pledgeId, status: paymentIntent.status }, "Unexpected payment status");
    }

    return true;
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;
    metrics.paymentFailures.inc({ reason: stripeError.code || "unknown" });
    metrics.externalApiCalls.inc({ service: "stripe", method: "paymentIntents.create", status: "error" });
    await schedulePaymentRetry(pledgeId, stripeError.message || "Payment failed");
    return false;
  }
}

/**
 * Schedule a payment retry
 */
export async function schedulePaymentRetry(pledgeId: string, failureReason: string) {
  const pledge = await db.pledge.findFirst({
    where: { id: pledgeId , deletedAt: null },
  });

  if (!pledge) return;

  const newRetryCount = pledge.retryCount + 1;

  if (newRetryCount > MAX_RETRY_ATTEMPTS) {
    await db.pledge.update({
      where: { id: pledgeId },
      data: {
        status: "FAILED",
        retryCount: newRetryCount,
        lastFailureReason: failureReason,
        nextRetryAt: null,
      },
    });

    // Reverse project stats if they were previously counted (SetupIntent pledges).
    // These pledges had stats incremented when the SetupIntent was confirmed.
    // Now that payment ultimately failed, we must undo those counts.
    if (pledge.confirmationEmailSent) {
      await db.project.update({
        where: { id: pledge.projectId },
        data: {
          backerCount: { decrement: 1 },
          currentAmount: { decrement: Number(pledge.amount) },
        },
      });
    }
    if (pledge.rewardId) {
      await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`;
    }

    const pledgeWithProject = await db.pledge.findFirst({
      where: { id: pledgeId , deletedAt: null },
      include: {
        project: {
          select: {
            title: true,
            slug: true,
            creator: { select: { vanityUrl: true } },
          },
        },
      },
    });

    if (pledgeWithProject) {
      const projectUrlPath = pledgeWithProject.project.creator?.vanityUrl
        ? `/projects/${pledgeWithProject.project.creator.vanityUrl}/${pledgeWithProject.project.slug}`
        : undefined;

      await notifyPledgeFailed(
        pledgeWithProject.projectId,
        pledgeWithProject.userId,
        pledgeWithProject.project.title,
        pledgeWithProject.project.slug,
        projectUrlPath
      );
    }
  } else {
    const nextRetryAt = new Date();
    nextRetryAt.setDate(nextRetryAt.getDate() + RETRY_INTERVAL_DAYS);

    await db.pledge.update({
      where: { id: pledgeId },
      data: {
        retryCount: newRetryCount,
        lastFailureReason: failureReason,
        nextRetryAt,
      },
    });
  }
}

/**
 * Process all pending pledges when a campaign reaches its goal
 * Processes pledges with saved payment methods, and also fetches payment methods
 * from Stripe for pledges that have SetupIntent but missing payment method.
 */
export async function processPendingPledgesForProject(projectId: string) {
  const stripeClient = await getStripeInstance();

  const pendingPledges = await db.pledge.findMany({
    where: {
      projectId,
      status: "PENDING",
      chargedImmediately: false,
      OR: [
        { stripePaymentMethodId: { not: null } },
        { stripeSetupIntentId: { not: null } },
        { confirmationEmailSent: true },
      ],
    },
  });

  const results = {
    total: 0,
    successful: 0,
    failed: 0,
  };

  for (const pledge of pendingPledges) {
    let paymentMethodId = pledge.stripePaymentMethodId;

    if (!paymentMethodId && pledge.stripeSetupIntentId) {
      try {
        const setupIntent = await circuitBreaker.execute("stripe", () =>
          stripeClient.setupIntents.retrieve(pledge.stripeSetupIntentId!)
        );
        metrics.externalApiCalls.inc({ service: "stripe", method: "setupIntents.retrieve" });
        if (setupIntent.status === "succeeded" && setupIntent.payment_method) {
          paymentMethodId = typeof setupIntent.payment_method === "string"
            ? setupIntent.payment_method
            : setupIntent.payment_method.id;

          await db.pledge.update({
            where: { id: pledge.id },
            data: { stripePaymentMethodId: paymentMethodId },
          });

          stripeLogger.info({ pledgeId: pledge.id }, "Fetched payment method from SetupIntent");
        }
      } catch (err) {
        stripeLogger.error({ pledgeId: pledge.id, err: err instanceof Error ? err.message : String(err) }, "Failed to fetch SetupIntent");
      }
    }

    if (!paymentMethodId) {
      stripeLogger.info({ pledgeId: pledge.id }, "Skipping pledge - no payment method");
      continue;
    }

    results.total++;

    try {
      const success = await chargeSavedPledge(pledge.id);
      if (success) {
        results.successful++;
      } else {
        results.failed++;
      }
    } catch {
      results.failed++;
    }
  }

  return results;
}

/**
 * Process payment retries - called by cron job
 */
export async function processPaymentRetries() {
  const now = new Date();

  const pledgesToRetry = await db.pledge.findMany({
    where: {
      status: "PENDING",
      retryCount: { gt: 0, lte: MAX_RETRY_ATTEMPTS },
      nextRetryAt: { lte: now },
      stripePaymentMethodId: { not: null },
      deletedAt: null,
    },
    take: 100,
  });

  const results = {
    total: pledgesToRetry.length,
    successful: 0,
    failed: 0,
  };

  for (const pledge of pledgesToRetry) {
    try {
      const success = await chargeSavedPledge(pledge.id);
      if (success) {
        results.successful++;
      } else {
        results.failed++;
      }
    } catch {
      results.failed++;
    }
  }

  return results;
}
