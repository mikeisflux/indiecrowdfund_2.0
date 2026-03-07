import Stripe from "stripe";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/metrics";
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
  webhookLogger.info({ paymentIntentId: paymentIntent.id }, "handlePaymentSuccess called");
  const pledgeId = paymentIntent.metadata.pledgeId;

  if (!pledgeId) {
    webhookLogger.info({ paymentIntentId: paymentIntent.id }, "No pledgeId in metadata, skipping");
    return;
  }
  webhookLogger.info({ pledgeId }, "Processing payment success");

  // Check if pledge is already completed (idempotency - webhook may fire after direct update)
  const existingPledge = await db.pledge.findUnique({
    where: { id: pledgeId },
    select: { status: true, projectId: true, backerNumber: true, sourceCampaignId: true },
  });

  if (existingPledge?.status === "COMPLETED") {
    webhookLogger.info({ pledgeId }, "Pledge already COMPLETED, skipping");
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
      webhookLogger.error({ pledgeId, err: emailListError instanceof Error ? emailListError.message : String(emailListError) }, "Failed to add backer to email list");
    }
  }

  // Update project stats using atomic confirmationEmailSent flag to prevent
  // double-counting between this webhook and the /confirm endpoint.
  let updatedProject = pledge.project;

  if (pledge.chargedImmediately) {
    const statsClaimResult = await db.pledge.updateMany({
      where: { id: pledgeId, confirmationEmailSent: false },
      data: { confirmationEmailSent: true },
    });

    if (statsClaimResult.count > 0) {
      updatedProject = await db.project.update({
        where: { id: pledge.projectId },
        data: {
          currentAmount: { increment: pledge.amount },
          backerCount: { increment: 1 },
        },
      });

      if (pledge.rewardId) {
        const claimed = await claimRewardSlot(pledge.rewardId);
        if (!claimed) {
          webhookLogger.warn({ pledgeId, rewardId: pledge.rewardId }, "Reward sold out, payment completed but reward unavailable");
        }
      }

      try {
        await notifyPledgeReceived(
          pledge.projectId,
          pledge.project.creatorId,
          pledge.user.name || "A backer",
          Number(pledge.amount)
        );
      } catch (notifyError) {
        webhookLogger.error({ pledgeId, err: notifyError instanceof Error ? notifyError.message : String(notifyError) }, "Failed to notify creator");
      }

      try {
        await notifyBackerPledgeConfirmed(pledge.id, true);
      } catch (emailError) {
        webhookLogger.error({ pledgeId, err: emailError instanceof Error ? emailError.message : String(emailError) }, "Failed to send confirmation email");
      }

      webhookLogger.info({ pledgeId, amount: Number(pledge.amount) }, "Updated project stats");
      metrics.pledgesCreated.inc({ type: "payment_completed" });
    } else {
      webhookLogger.info({ pledgeId }, "Stats already updated by /confirm, skipping stat update");
      const freshProject = await db.project.findUnique({
        where: { id: pledge.projectId },
        select: { currentAmount: true, goalAmount: true },
      });
      if (freshProject) {
        updatedProject = { ...updatedProject, ...freshProject };
      }
    }
  } else {
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
        webhookLogger.error({ projectId: pledge.projectId, err: fundedError instanceof Error ? fundedError.message : String(fundedError) }, "Failed to notify project funded");
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
  webhookLogger.warn({ pledgeId, error: failureMessage }, "Payment failed");
  metrics.paymentFailures.inc({ reason: "payment_intent_failed" });

  // Schedule retry instead of immediately failing
  await schedulePaymentRetry(pledgeId, failureMessage);
}

async function handleSetupIntentSuccess(setupIntent: Stripe.SetupIntent) {
  const pledgeId = setupIntent.metadata?.pledgeId;

  if (!pledgeId) return;

  const paymentMethodId = typeof setupIntent.payment_method === "string"
    ? setupIntent.payment_method
    : setupIntent.payment_method?.id;

  if (!paymentMethodId) return;

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

  // If already processed, still check for funded project as failsafe
  if (existingPledge.stripePaymentMethodId && existingPledge.confirmationEmailSent) {
    webhookLogger.info({ pledgeId }, "Pledge already processed, checking if project needs processing");

    const projectIsFunded = Number(existingPledge.project.currentAmount) >= Number(existingPledge.project.goalAmount);
    if (projectIsFunded) {
      webhookLogger.info({ pledgeId, projectId: existingPledge.projectId }, "Project is funded, processing pending pledges as failsafe");
      const chargeResults = await processPendingPledgesForProject(existingPledge.projectId);
      webhookLogger.info({ pledgeId, successful: chargeResults.successful, total: chargeResults.total }, "Failsafe charge results");
    }
    return;
  }

  // Assign backer number atomically if not already assigned
  let backerNumber = existingPledge.backerNumber;
  if (!backerNumber) {
    backerNumber = await assignBackerNumber(existingPledge.projectId, pledgeId);
  }

  // Save the payment method to the pledge
  await db.pledge.update({
    where: { id: pledgeId },
    data: {
      stripePaymentMethodId: paymentMethodId,
    },
  });

  webhookLogger.info({ pledgeId, backerNumber }, "Payment method saved");

  // Atomically claim the right to update stats
  const statsClaimResult = await db.pledge.updateMany({
    where: { id: pledgeId, confirmationEmailSent: false },
    data: { confirmationEmailSent: true },
  });

  let currentProjectAmount = existingPledge.project.currentAmount;

  if (statsClaimResult.count > 0 && !existingPledge.chargedImmediately) {
    const updatedProject = await db.project.update({
      where: { id: existingPledge.projectId },
      data: {
        currentAmount: { increment: existingPledge.amount },
        backerCount: { increment: 1 },
      },
    });

    currentProjectAmount = updatedProject.currentAmount;

    if (existingPledge.rewardId) {
      const claimed = await claimRewardSlot(existingPledge.rewardId);
      if (!claimed) {
        webhookLogger.warn({ pledgeId, rewardId: existingPledge.rewardId }, "Reward sold out, payment completed but reward unavailable");
      }
    }

    try {
      await notifyPledgeReceived(
        existingPledge.projectId,
        existingPledge.project.creatorId,
        existingPledge.user?.name || "A backer",
        existingPledge.amount
      );
    } catch (notifyError) {
      webhookLogger.error({ pledgeId, err: notifyError instanceof Error ? notifyError.message : String(notifyError) }, "Failed to notify creator");
    }

    webhookLogger.info({ pledgeId, amount: Number(existingPledge.amount) }, "Updated project stats");
    metrics.pledgesCreated.inc({ type: "setup_intent_completed" });

    const justReachedGoal = currentProjectAmount >= existingPledge.project.goalAmount &&
      currentProjectAmount - existingPledge.amount < existingPledge.project.goalAmount;
    if (justReachedGoal) {
      try {
        await notifyProjectFunded(existingPledge.projectId);
      } catch (fundedError) {
        webhookLogger.error({ projectId: existingPledge.projectId, err: fundedError instanceof Error ? fundedError.message : String(fundedError) }, "Failed to notify project funded");
      }
    }

    try {
      await notifyBackerPledgeConfirmed(pledgeId, false);
    } catch (emailError) {
      webhookLogger.error({ pledgeId, err: emailError instanceof Error ? emailError.message : String(emailError) }, "Failed to send confirmation email");
    }
  } else if (statsClaimResult.count === 0) {
    webhookLogger.info({ pledgeId }, "Stats already updated by /confirm");
    const freshProject = await db.project.findUnique({
      where: { id: existingPledge.projectId },
      select: { currentAmount: true },
    });
    if (freshProject) {
      currentProjectAmount = freshProject.currentAmount;
    }
  }

  // ALWAYS check if project is funded and process pending pledges
  const projectIsFunded = currentProjectAmount >= existingPledge.project.goalAmount;

  if (projectIsFunded) {
    webhookLogger.info({ projectId: existingPledge.projectId, currentAmount: currentProjectAmount, goalAmount: existingPledge.project.goalAmount }, "Project is funded, processing pending pledges");

    const chargeResults = await processPendingPledgesForProject(existingPledge.projectId);
    webhookLogger.info({ projectId: existingPledge.projectId, successful: chargeResults.successful, total: chargeResults.total }, "Charged pending pledges");
  }
}

async function handleAccountUpdate(account: Stripe.Account) {
  const config = await db.stripeConfig.findFirst({
    where: { stripeAccountId: account.id },
  });

  if (!config) return;

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
  webhookLogger.info({ sessionId: session.id }, "handleCheckoutSessionCompleted called");

  const purchaseId = session.metadata?.purchaseId;
  const type = session.metadata?.type;

  if (type !== "marketplace_purchase" || !purchaseId) {
    webhookLogger.info({ sessionId: session.id }, "Not a marketplace purchase, skipping");
    return;
  }

  if (session.payment_status !== "paid") {
    webhookLogger.info({ sessionId: session.id, paymentStatus: session.payment_status }, "Payment not completed, skipping");
    return;
  }

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
    webhookLogger.warn({ purchaseId }, "Purchase not found");
    return;
  }

  if (purchase.status === "COMPLETED") {
    webhookLogger.info({ purchaseId }, "Purchase already completed");
    return;
  }

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

  await db.marketplaceBook.update({
    where: { id: purchase.bookId },
    data: {
      purchaseCount: { increment: 1 },
    },
  });

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
    webhookLogger.error({ purchaseId, err: err instanceof Error ? err.message : String(err) }, "Failed to notify marketplace purchase")
  );
  notifyMarketplaceSale(purchaseId, "STRIPE").catch((err) =>
    webhookLogger.error({ purchaseId, err: err instanceof Error ? err.message : String(err) }, "Failed to notify marketplace sale")
  );

  webhookLogger.info({ purchaseId }, "Marketplace purchase completed successfully");
}
