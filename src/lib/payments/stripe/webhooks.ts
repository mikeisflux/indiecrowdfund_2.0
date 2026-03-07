import Stripe from "stripe";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  notifyPledgeReceived,
  notifyProjectFunded,
  notifyBackerPledgeConfirmed,
  notifyMarketplacePurchase,
  notifyMarketplaceSale,
} from "@/lib/notifications";
import { addToCreatorEmailList } from "@/lib/email";
import { trackCampaignConversion, claimRewardSlot, assignBackerNumber } from "./rewards";
import { processPendingPledgesForProject, schedulePaymentRetry } from "./charges";

const webhookLogger = logger.child({ module: "stripe-webhook" });

export async function handleStripeWebhook(
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
      await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
      break;

    case "payment_intent.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      break;

    case "setup_intent.succeeded":
      await handleSetupIntentSuccess(event.data.object as Stripe.SetupIntent);
      break;

    case "account.updated":
      await handleAccountUpdate(event.data.object as Stripe.Account);
      break;

    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      break;
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[Webhook] handlePaymentSuccess called for PaymentIntent ${paymentIntent.id}`);
  const pledgeId = paymentIntent.metadata.pledgeId;

  if (!pledgeId) {
    console.log(`[Webhook] No pledgeId in metadata for PaymentIntent ${paymentIntent.id}, skipping`);
    return;
  }
  console.log(`[Webhook] Processing payment success for pledge ${pledgeId}`);

  // Check if pledge is already completed (idempotency - webhook may fire after direct update)
  const existingPledge = await db.pledge.findUnique({
    where: { id: pledgeId },
    select: { status: true, projectId: true, backerNumber: true, sourceCampaignId: true },
  });

  if (existingPledge?.status === "COMPLETED") {
    console.log(`[Webhook] Pledge ${pledgeId} already COMPLETED, skipping`);
    return;
  }

  // Save the payment method for potential future use
  const paymentMethodId = typeof paymentIntent.payment_method === "string"
    ? paymentIntent.payment_method
    : paymentIntent.payment_method?.id;

  // Assign backer number atomically if not already assigned
  if (!existingPledge?.backerNumber && existingPledge?.projectId) {
    await assignBackerNumber(existingPledge.projectId, pledgeId);
  }

  const pledge = await db.pledge.update({
    where: { id: pledgeId },
    data: {
      status: "COMPLETED",
      stripePaymentIntentId: paymentIntent.id,
      stripePaymentMethodId: paymentMethodId,
      retryCount: 0,
      nextRetryAt: null,
      lastFailureReason: null,
    },
    include: {
      project: {
        include: {
          creator: true,
        },
      },
      user: true,
    },
  });

  // Track conversion if this pledge came from an email campaign
  if (existingPledge?.sourceCampaignId) {
    await trackCampaignConversion(pledgeId, existingPledge.sourceCampaignId);
  }

  // Auto-add backer to creator's email list (non-blocking)
  if (pledge.user?.email) {
    try {
      await addToCreatorEmailList({
        creatorId: pledge.project.creatorId,
        email: pledge.user.email,
        name: pledge.user.name,
        source: "pledge",
        sourceProjectId: pledge.projectId,
      });
    } catch (emailListError) {
      console.error(`[Webhook] Failed to add backer to email list:`, emailListError);
    }
  }

  // Update project stats using atomic confirmationEmailSent flag to prevent
  // double-counting between this webhook and the /confirm endpoint.
  // Both paths use this flag: whoever sets it first gets to update stats.
  let updatedProject = pledge.project;

  if (pledge.chargedImmediately) {
    // Atomically claim the right to update stats — only one of webhook or /confirm will succeed
    const statsClaimResult = await db.pledge.updateMany({
      where: { id: pledgeId, confirmationEmailSent: false },
      data: { confirmationEmailSent: true },
    });

    if (statsClaimResult.count > 0) {
      // We won the race — update project stats
      updatedProject = await db.project.update({
        where: { id: pledge.projectId },
        data: {
          currentAmount: { increment: pledge.amount },
          backerCount: { increment: 1 },
        },
      });

      // Atomically claim reward slot if pledge has a reward (prevents overselling)
      if (pledge.rewardId) {
        const claimed = await claimRewardSlot(pledge.rewardId);
        if (!claimed) {
          console.warn(`[Webhook] Reward ${pledge.rewardId} sold out for pledge ${pledgeId} - payment completed but reward unavailable`);
        }
      }

      // Notify creator of new pledge (non-blocking)
      try {
        await notifyPledgeReceived(
          pledge.projectId,
          pledge.project.creatorId,
          pledge.user.name || "A backer",
          Number(pledge.amount)
        );
      } catch (notifyError) {
        console.error(`[Webhook] Failed to notify creator for pledge ${pledgeId}:`, notifyError);
      }

      // Send confirmation email to backer (non-blocking)
      try {
        await notifyBackerPledgeConfirmed(pledge.id, true);
      } catch (emailError) {
        console.error(`[Webhook] Failed to send confirmation email for pledge ${pledgeId}:`, emailError);
      }

      console.log(`[Webhook] Updated project stats for pledge ${pledgeId}: +$${pledge.amount}`);
    } else {
      // /confirm endpoint already updated stats — just re-read project for funding check
      console.log(`[Webhook] Stats already updated by /confirm for pledge ${pledgeId}, skipping stat update`);
      const freshProject = await db.project.findUnique({
        where: { id: pledge.projectId },
        select: { currentAmount: true, goalAmount: true },
      });
      if (freshProject) {
        updatedProject = { ...updatedProject, ...freshProject };
      }
    }
  } else {
    // SetupIntent pledge — stats were already counted when SetupIntent was confirmed.
    // Don't double-count. Just check if stats need a funding check.
    const freshProject = await db.project.findUnique({
      where: { id: pledge.projectId },
      select: { currentAmount: true, goalAmount: true },
    });
    if (freshProject) {
      updatedProject = { ...updatedProject, ...freshProject };
    }
  }

  // Check if project is now funded
  if (pledge.chargedImmediately) {
    const projectIsFunded = Number(updatedProject.currentAmount) >= Number(updatedProject.goalAmount);

    const justReachedGoal = projectIsFunded &&
      Number(updatedProject.currentAmount) - Number(pledge.amount) < Number(updatedProject.goalAmount);

    if (justReachedGoal) {
      try {
        await notifyProjectFunded(pledge.projectId);
      } catch (fundedError) {
        console.error(`[Webhook] Failed to notify project funded for ${pledge.projectId}:`, fundedError);
      }
    }

    if (projectIsFunded) {
      const pendingPledgeCount = await db.pledge.count({
        where: {
          projectId: pledge.projectId,
          status: "PENDING",
          chargedImmediately: false,
          stripePaymentMethodId: { not: null },
        },
      });

      if (pendingPledgeCount > 0) {
        await processPendingPledgesForProject(pledge.projectId);
      }
    }
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const pledgeId = paymentIntent.metadata.pledgeId;

  if (!pledgeId) return;

  const failureMessage = paymentIntent.last_payment_error?.message || "Payment failed";

  // Schedule retry instead of immediately failing
  await schedulePaymentRetry(pledgeId, failureMessage);
}

async function handleSetupIntentSuccess(setupIntent: Stripe.SetupIntent) {
  const pledgeId = setupIntent.metadata?.pledgeId;

  if (!pledgeId) return;

  // Get the payment method ID
  const paymentMethodId = typeof setupIntent.payment_method === "string"
    ? setupIntent.payment_method
    : setupIntent.payment_method?.id;

  if (!paymentMethodId) return;

  // Get the pledge with project info
  const existingPledge = await db.pledge.findUnique({
    where: { id: pledgeId },
    select: {
      stripePaymentMethodId: true,
      status: true,
      confirmationEmailSent: true,
      amount: true,
      projectId: true,
      rewardId: true,
      chargedImmediately: true,
      backerNumber: true,
      project: {
        select: {
          id: true,
          goalAmount: true,
          currentAmount: true,
          creatorId: true,
          title: true,
        },
      },
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!existingPledge) return;

  // If already processed (payment method saved AND confirmed), still check for funded project
  // This acts as a failsafe - duplicate webhook calls can still trigger processing
  if (existingPledge.stripePaymentMethodId && existingPledge.confirmationEmailSent) {
    console.log(`[SetupIntent] Pledge ${pledgeId} already processed, checking if project needs processing...`);

    // Still check if project is funded and process pending pledges as failsafe
    const projectIsFunded = Number(existingPledge.project.currentAmount) >= Number(existingPledge.project.goalAmount);
    if (projectIsFunded) {
      console.log(`[SetupIntent] Project ${existingPledge.projectId} is funded, processing pending pledges as failsafe...`);
      const chargeResults = await processPendingPledgesForProject(existingPledge.projectId);
      console.log(`[SetupIntent] Failsafe charged ${chargeResults.successful}/${chargeResults.total} pledges`);
    }
    return;
  }

  // Assign backer number atomically if not already assigned
  let backerNumber = existingPledge.backerNumber;
  if (!backerNumber) {
    backerNumber = await assignBackerNumber(existingPledge.projectId, pledgeId);
  }

  // Save the payment method to the pledge (always do this, even if /confirm already ran)
  await db.pledge.update({
    where: { id: pledgeId },
    data: {
      stripePaymentMethodId: paymentMethodId,
    },
  });

  console.log(`[SetupIntent] Payment method saved for pledge ${pledgeId}, backer #${backerNumber}`);

  // Atomically claim the right to update stats using confirmationEmailSent flag.
  // This prevents double-counting between this webhook and the /confirm endpoint.
  const statsClaimResult = await db.pledge.updateMany({
    where: { id: pledgeId, confirmationEmailSent: false },
    data: { confirmationEmailSent: true },
  });

  let currentProjectAmount = existingPledge.project.currentAmount;

  if (statsClaimResult.count > 0 && !existingPledge.chargedImmediately) {
    // We won the race — update project stats
    const updatedProject = await db.project.update({
      where: { id: existingPledge.projectId },
      data: {
        currentAmount: { increment: existingPledge.amount },
        backerCount: { increment: 1 },
      },
    });

    currentProjectAmount = updatedProject.currentAmount;

    // Atomically claim reward slot if pledge has a reward
    if (existingPledge.rewardId) {
      const claimed = await claimRewardSlot(existingPledge.rewardId);
      if (!claimed) {
        console.warn(`[SetupIntent] Reward ${existingPledge.rewardId} sold out for pledge ${pledgeId} - payment completed but reward unavailable`);
      }
    }

    // Notify creator of new pledge (non-blocking)
    try {
      await notifyPledgeReceived(
        existingPledge.projectId,
        existingPledge.project.creatorId,
        existingPledge.user?.name || "A backer",
        existingPledge.amount
      );
    } catch (notifyError) {
      console.error(`[SetupIntent] Failed to notify creator for pledge ${pledgeId}:`, notifyError);
    }

    console.log(`[SetupIntent] Updated project stats: +$${existingPledge.amount}`);

    // Notify that project was funded (if this pledge pushed it over)
    const justReachedGoal = currentProjectAmount >= existingPledge.project.goalAmount &&
      currentProjectAmount - existingPledge.amount < existingPledge.project.goalAmount;
    if (justReachedGoal) {
      try {
        await notifyProjectFunded(existingPledge.projectId);
      } catch (fundedError) {
        console.error(`[SetupIntent] Failed to notify project funded for ${existingPledge.projectId}:`, fundedError);
      }
    }

    // Send confirmation email to backer (non-blocking)
    try {
      await notifyBackerPledgeConfirmed(pledgeId, false);
    } catch (emailError) {
      console.error(`[SetupIntent] Failed to send confirmation email for pledge ${pledgeId}:`, emailError);
    }
  } else if (statsClaimResult.count === 0) {
    // /confirm endpoint already handled stats — re-read current project amount for funding check
    console.log(`[SetupIntent] Stats already updated by /confirm for pledge ${pledgeId}`);
    const freshProject = await db.project.findUnique({
      where: { id: existingPledge.projectId },
      select: { currentAmount: true },
    });
    if (freshProject) {
      currentProjectAmount = freshProject.currentAmount;
    }
  }

  // ALWAYS check if project is funded and process pending pledges
  // This acts as a failsafe - every new backer on a funded project triggers processing
  // The duplicate charge prevention (idempotency keys, PaymentIntent checks) prevents double-charging
  const projectIsFunded = currentProjectAmount >= existingPledge.project.goalAmount;

  if (projectIsFunded) {
    console.log(`[SetupIntent] Project ${existingPledge.projectId} is funded (${currentProjectAmount}/${existingPledge.project.goalAmount}). Processing pending pledges...`);

    // Process all pending pledges (charge saved cards)
    const chargeResults = await processPendingPledgesForProject(existingPledge.projectId);
    console.log(`[SetupIntent] Charged ${chargeResults.successful}/${chargeResults.total} pledges`);
  }
}

async function handleAccountUpdate(account: Stripe.Account) {
  // Find the user with this Stripe account
  const config = await db.stripeConfig.findFirst({
    where: { stripeAccountId: account.id },
  });

  if (!config) return;

  // Update onboarding status
  const isOnboarded =
    account.charges_enabled && account.payouts_enabled;

  await db.stripeConfig.update({
    where: { id: config.id },
    data: { isOnboarded },
  });
}

/**
 * Handle Stripe Checkout Session completion
 * Used for marketplace purchases
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log(`[Webhook] handleCheckoutSessionCompleted called for session ${session.id}`);

  // Check if this is a marketplace purchase
  const purchaseId = session.metadata?.purchaseId;
  const type = session.metadata?.type;

  if (type !== "marketplace_purchase" || !purchaseId) {
    console.log(`[Webhook] Session ${session.id} is not a marketplace purchase, skipping`);
    return;
  }

  // Verify payment was successful
  if (session.payment_status !== "paid") {
    console.log(`[Webhook] Session ${session.id} payment status is ${session.payment_status}, skipping`);
    return;
  }

  // Find and update the purchase
  const purchase = await db.marketplacePurchase.findUnique({
    where: { id: purchaseId },
    include: {
      book: {
        select: {
          id: true,
          companyId: true,
        },
      },
    },
  });

  if (!purchase) {
    console.log(`[Webhook] Purchase ${purchaseId} not found`);
    return;
  }

  // Skip if already completed
  if (purchase.status === "COMPLETED") {
    console.log(`[Webhook] Purchase ${purchaseId} already completed`);
    return;
  }

  // Complete the purchase
  await db.marketplacePurchase.update({
    where: { id: purchaseId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      deliveredAt: new Date(),
      stripePaymentIntentId: typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent || undefined,
    },
  });

  // Update book purchase count
  await db.marketplaceBook.update({
    where: { id: purchase.bookId },
    data: {
      purchaseCount: { increment: 1 },
    },
  });

  // Update company total sales if applicable
  if (purchase.book.companyId) {
    await db.companyProfile.update({
      where: { id: purchase.book.companyId },
      data: {
        totalSales: { increment: 1 },
      },
    });
  }

  // Send notifications (don't await to avoid blocking webhook response)
  notifyMarketplacePurchase(purchaseId, "STRIPE").catch((err) =>
    console.error(`[Webhook] Failed to notify marketplace purchase ${purchaseId}:`, err)
  );
  notifyMarketplaceSale(purchaseId, "STRIPE").catch((err) =>
    console.error(`[Webhook] Failed to notify marketplace sale ${purchaseId}:`, err)
  );

  console.log(`[Webhook] Marketplace purchase ${purchaseId} completed successfully`);
}
