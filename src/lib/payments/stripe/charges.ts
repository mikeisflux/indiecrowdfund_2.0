import Stripe from "stripe";
import { db } from "@/lib/db";
import {
  notifyPledgeFailed,
  notifyBackerPledgeConfirmed,
} from "@/lib/notifications";
import { getStripeInstance } from "./config";
import { trackCampaignConversion, assignBackerNumber } from "./rewards";

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

  const pledge = await db.pledge.findUnique({
    where: { id: pledgeId },
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
  });

  if (!pledge) {
    throw new Error("Pledge not found");
  }

  // SAFETY: Skip if already processed
  if (pledge.status !== "PENDING") {
    console.log(`[ChargePledge] Pledge ${pledgeId} already ${pledge.status} - skipping`);
    return false;
  }

  // SAFETY: If this pledge already has a PaymentIntent, check its status instead of creating new one
  if (pledge.stripePaymentIntentId) {
    try {
      const existingIntent = await stripeClient.paymentIntents.retrieve(pledge.stripePaymentIntentId);

      if (existingIntent.status === "succeeded") {
        // Already charged successfully - update our record if needed
        console.log(`[ChargePledge] PaymentIntent ${pledge.stripePaymentIntentId} already succeeded - updating pledge ${pledgeId}`);
        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            status: "COMPLETED",
            retryCount: 0,
            nextRetryAt: null,
            lastFailureReason: null,
          },
        });
        // Track conversion if this pledge came from an email campaign
        if (pledge.sourceCampaignId) {
          await trackCampaignConversion(pledgeId, pledge.sourceCampaignId);
        }
        return true;
      } else if (existingIntent.status === "processing") {
        // Payment is in progress - don't create another one
        console.log(`[ChargePledge] PaymentIntent ${pledge.stripePaymentIntentId} is processing - skipping pledge ${pledgeId}`);
        return false;
      } else if (existingIntent.status === "canceled" || existingIntent.status === "requires_payment_method") {
        // Previous attempt was canceled or failed - we can try again (clear the old intent)
        console.log(`[ChargePledge] PaymentIntent ${pledge.stripePaymentIntentId} status ${existingIntent.status} - will create new one`);
        // Clear the old intent ID so we create a new one below
        await db.pledge.update({
          where: { id: pledgeId },
          data: { stripePaymentIntentId: null },
        });
      } else if (existingIntent.status === "requires_action") {
        // 3D Secure or other action required - leave for user to complete
        console.log(`[ChargePledge] PaymentIntent ${pledge.stripePaymentIntentId} requires action - skipping`);
        return false;
      } else if (existingIntent.status === "requires_confirmation") {
        // Try to confirm it
        try {
          const confirmedIntent = await stripeClient.paymentIntents.confirm(pledge.stripePaymentIntentId);
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
            // Track conversion if this pledge came from an email campaign
            if (pledge.sourceCampaignId) {
              await trackCampaignConversion(pledgeId, pledge.sourceCampaignId);
            }
            return true;
          }
        } catch {
          // Confirmation failed - will create new intent
          console.log(`[ChargePledge] Failed to confirm PaymentIntent ${pledge.stripePaymentIntentId} - will create new one`);
          await db.pledge.update({
            where: { id: pledgeId },
            data: { stripePaymentIntentId: null },
          });
        }
      } else {
        // Unknown status - skip for safety
        console.log(`[ChargePledge] PaymentIntent ${pledge.stripePaymentIntentId} status is ${existingIntent.status} - skipping`);
        return false;
      }
    } catch {
      // Intent doesn't exist anymore - clear it and proceed
      console.log(`[ChargePledge] Could not retrieve PaymentIntent ${pledge.stripePaymentIntentId} - will create new one`);
      await db.pledge.update({
        where: { id: pledgeId },
        data: { stripePaymentIntentId: null },
      });
    }
  }

  if (!pledge.stripePaymentMethodId || !pledge.stripeCustomerId) {
    // No saved payment method - mark as failed
    await db.pledge.update({
      where: { id: pledgeId },
      data: {
        status: "FAILED",
        lastFailureReason: "No saved payment method",
      },
    });
    return false;
  }

  // CRITICAL SAFETY CHECK: Verify payment method is still attached to customer
  // This prevents charging if admin cancelled/deleted the pledge and detached the payment method
  try {
    const paymentMethod = await stripeClient.paymentMethods.retrieve(pledge.stripePaymentMethodId);
    if (!paymentMethod.customer) {
      console.log(`[ChargePledge] Payment method ${pledge.stripePaymentMethodId} is detached - skipping charge for pledge ${pledgeId}`);
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
    // Also verify it's attached to the correct customer
    if (paymentMethod.customer !== pledge.stripeCustomerId) {
      console.log(`[ChargePledge] Payment method ${pledge.stripePaymentMethodId} attached to wrong customer - skipping`);
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "FAILED",
          lastFailureReason: "Payment method attached to different customer",
        },
      });
      return false;
    }
  } catch {
    console.log(`[ChargePledge] Could not retrieve payment method ${pledge.stripePaymentMethodId} - marking as cancelled`);
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
  const freshPledge = await db.pledge.findUnique({
    where: { id: pledgeId },
    select: { status: true, stripePaymentMethodId: true },
  });
  if (freshPledge?.status !== "PENDING" || !freshPledge.stripePaymentMethodId) {
    console.log(`[ChargePledge] Pledge ${pledgeId} status changed to ${freshPledge?.status} - skipping charge`);
    return false;
  }

  const connectedAccountId = pledge.project.creator.stripeConfig?.stripeAccountId;
  if (!connectedAccountId) {
    throw new Error("Creator has not connected Stripe");
  }

  const amountInCents = Math.round(Number(pledge.amount) * 100);
  const platformFee = Math.round(Number(pledge.amount) * 0.03 * 100);

  try {
    // Generate idempotency key based on pledgeId AND retryCount
    // This ensures that:
    // 1. Multiple processes charging the same pledge simultaneously get the same PaymentIntent (no duplicates)
    // 2. Legitimate retries (after card decline) get a new PaymentIntent (different retryCount)
    const idempotencyKey = `charge_pledge_${pledgeId}_v${pledge.retryCount}`;

    // Create PaymentIntent with saved payment method (off-session)
    const paymentIntent = await stripeClient.paymentIntents.create(
      {
        amount: amountInCents,
        currency: "usd",
        customer: pledge.stripeCustomerId,
        payment_method: pledge.stripePaymentMethodId,
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
        idempotencyKey, // Prevents duplicate charges for same pledge
      }
    );

    // Since confirm: true, we know immediately if the payment succeeded
    // Update pledge status based on PaymentIntent status (don't rely solely on webhook)
    if (paymentIntent.status === "succeeded") {
      // Payment succeeded - update pledge to COMPLETED with atomic backer number assignment
      let finalBackerNumber: number;
      if (pledge.backerNumber) {
        // Already has backer number, just update status
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
        // Assign backer number atomically and update status
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

      // Track conversion if this pledge came from an email campaign
      if (pledge.sourceCampaignId) {
        await trackCampaignConversion(pledgeId, pledge.sourceCampaignId);
      }

      // Send confirmation email to backer
      try {
        await notifyBackerPledgeConfirmed(pledgeId, true);
      } catch (e) {
        console.warn(`Could not send confirmation email for pledge ${pledgeId}:`, e);
      }

      console.log(`[ChargePledge] Payment succeeded for pledge ${pledgeId}, backer #${finalBackerNumber}, status updated to COMPLETED`);
    } else if (paymentIntent.status === "processing") {
      // Payment is processing - save intent ID, status will be updated by webhook
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          stripePaymentIntentId: paymentIntent.id,
        },
      });
      console.log(`[ChargePledge] Payment processing for pledge ${pledgeId}, waiting for webhook`);
    } else {
      // Unexpected status - save intent ID for tracking
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          stripePaymentIntentId: paymentIntent.id,
        },
      });
      console.log(`[ChargePledge] Unexpected payment status ${paymentIntent.status} for pledge ${pledgeId}`);
    }

    return true;
  } catch (error) {
    // Payment failed - schedule retry
    const stripeError = error as Stripe.errors.StripeError;
    await schedulePaymentRetry(pledgeId, stripeError.message || "Payment failed");
    return false;
  }
}

/**
 * Schedule a payment retry
 */
export async function schedulePaymentRetry(pledgeId: string, failureReason: string) {
  const pledge = await db.pledge.findUnique({
    where: { id: pledgeId },
  });

  if (!pledge) return;

  const newRetryCount = pledge.retryCount + 1;

  if (newRetryCount > MAX_RETRY_ATTEMPTS) {
    // Max retries reached - mark as permanently failed
    await db.pledge.update({
      where: { id: pledgeId },
      data: {
        status: "FAILED",
        retryCount: newRetryCount,
        lastFailureReason: failureReason,
        nextRetryAt: null,
      },
    });

    // Notify backer of final failure
    const pledgeWithProject = await db.pledge.findUnique({
      where: { id: pledgeId },
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
      // Build project URL with vanity URL if available
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
    // Schedule next retry (3 days from now)
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

  // Find all pending pledges that could potentially be charged
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
    // If no payment method saved, try to fetch from Stripe via SetupIntent
    let paymentMethodId = pledge.stripePaymentMethodId;

    if (!paymentMethodId && pledge.stripeSetupIntentId) {
      try {
        const setupIntent = await stripeClient.setupIntents.retrieve(pledge.stripeSetupIntentId);
        if (setupIntent.status === "succeeded" && setupIntent.payment_method) {
          paymentMethodId = typeof setupIntent.payment_method === "string"
            ? setupIntent.payment_method
            : setupIntent.payment_method.id;

          // Save the payment method to the pledge
          await db.pledge.update({
            where: { id: pledge.id },
            data: { stripePaymentMethodId: paymentMethodId },
          });

          console.log(`[ProcessPledges] Fetched payment method for pledge ${pledge.id}`);
        }
      } catch (err) {
        console.error(`[ProcessPledges] Failed to fetch SetupIntent for pledge ${pledge.id}:`, err);
      }
    }

    // Only count and process pledges that have a payment method
    if (!paymentMethodId) {
      console.log(`[ProcessPledges] Skipping pledge ${pledge.id} - no payment method`);
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

  // Find pledges due for retry
  const pledgesToRetry = await db.pledge.findMany({
    where: {
      status: "PENDING",
      retryCount: { gt: 0, lte: MAX_RETRY_ATTEMPTS },
      nextRetryAt: { lte: now },
      stripePaymentMethodId: { not: null },
    },
    take: 100, // Process in batches
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
