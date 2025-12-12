import Stripe from "stripe";
import { db } from "@/lib/db";
import {
  notifyPledgeReceived,
  notifyPledgeFailed,
  notifyProjectFunded,
  notifyBackerPledgeConfirmed,
} from "@/lib/notifications";

let stripeInstance: Stripe | null = null;
let cachedSecretKey: string | null = null;

// Retry configuration: 3 attempts, every 3 days
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_INTERVAL_DAYS = 3;

/**
 * Get app URL with HTTPS enforced for live mode Stripe
 * Stripe live mode requires all redirect URLs to use HTTPS
 */
export function getSecureAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // In production or when using live Stripe keys, ensure HTTPS
  if (process.env.NODE_ENV === "production" ||
      (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith("sk_test_"))) {
    return appUrl.replace(/^http:\/\//i, "https://");
  }

  return appUrl;
}

// Get Stripe secret key from database settings or fall back to env var
async function getStripeSecretKey(): Promise<string> {
  // Try to get from database settings first
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { stripeSecretKey: true, stripeEnabled: true },
    });

    if (settings?.stripeSecretKey && settings.stripeEnabled) {
      return settings.stripeSecretKey;
    }
  } catch (error) {
    console.warn("Could not fetch Stripe settings from database:", error);
  }

  // Fall back to environment variable
  if (process.env.STRIPE_SECRET_KEY) {
    return process.env.STRIPE_SECRET_KEY;
  }

  throw new Error("Stripe secret key not configured. Please set it in Admin Settings > Payments or via STRIPE_SECRET_KEY environment variable.");
}

// Get Stripe publishable key from database settings or fall back to env var
export async function getStripePublishableKey(): Promise<string | null> {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { stripePublishableKey: true, stripeEnabled: true },
    });

    if (settings?.stripePublishableKey && settings.stripeEnabled) {
      return settings.stripePublishableKey;
    }
  } catch (error) {
    console.warn("Could not fetch Stripe settings from database:", error);
  }

  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;
}

// Get Stripe webhook secret from database settings or fall back to env var
export async function getStripeWebhookSecret(): Promise<string | null> {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { stripeWebhookSecret: true, stripeEnabled: true },
    });

    if (settings?.stripeWebhookSecret && settings.stripeEnabled) {
      return settings.stripeWebhookSecret;
    }
  } catch (error) {
    console.warn("Could not fetch Stripe settings from database:", error);
  }

  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

// Initialize or get cached Stripe instance
async function getStripeInstance(): Promise<Stripe> {
  const secretKey = await getStripeSecretKey();

  // Re-create instance if key changed or doesn't exist
  if (!stripeInstance || cachedSecretKey !== secretKey) {
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2025-11-17.clover",
    });
    cachedSecretKey = secretKey;
  }

  return stripeInstance;
}

// Synchronous getter that throws if not initialized - for backwards compatibility
function getStripe(): Stripe {
  if (!stripeInstance) {
    // Try to use env var for synchronous access
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe not initialized. Call getStripeInstance() first or set STRIPE_SECRET_KEY environment variable.");
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-11-17.clover",
    });
    cachedSecretKey = process.env.STRIPE_SECRET_KEY;
  }
  return stripeInstance;
}

// Proxy for backwards compatibility - prefers async initialization
const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

export { getStripeInstance };

interface CreatePaymentParams {
  projectId: string;
  rewardId: string | null | undefined; // Optional for "pledge without reward"
  addonIds: string[];
  amount: number;
  userId: string;
}

interface StripeConnectParams {
  userId: string;
  email: string;
}

export async function createStripeConnectAccount({
  userId,
  email,
}: StripeConnectParams) {
  // Get Stripe instance with database settings
  const stripeClient = await getStripeInstance();

  // Create Express account
  const account = await stripeClient.accounts.create({
    type: "express",
    country: "US",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
  });

  // Save to database
  await db.stripeConfig.upsert({
    where: { userId },
    create: {
      userId,
      stripeAccountId: account.id,
      isOnboarded: false,
    },
    update: {
      stripeAccountId: account.id,
      isOnboarded: false,
    },
  });

  // Create account link for onboarding
  // Use secure URL helper to ensure HTTPS for live mode
  const baseUrl = getSecureAppUrl();
  const accountLink = await stripeClient.accountLinks.create({
    account: account.id,
    refresh_url: `${baseUrl}/settings/payment/stripe/refresh`,
    return_url: `${baseUrl}/settings/payment/stripe/complete`,
    type: "account_onboarding",
  });

  return {
    accountId: account.id,
    onboardingUrl: accountLink.url,
  };
}

/**
 * Create or get a Stripe Customer for the user
 */
async function getOrCreateStripeCustomer(
  stripeClient: Stripe,
  userId: string,
  email: string
): Promise<string> {
  // Check if user already has a Stripe customer ID
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true, name: true },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripeClient.customers.create({
    email: email || user?.email || undefined,
    name: user?.name || undefined,
    metadata: {
      userId,
    },
  });

  // Save customer ID to user record
  await db.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Main payment creation function
 * - If campaign is NOT funded: Creates SetupIntent to save card (charge later when funded)
 * - If campaign IS funded: Creates PaymentIntent with immediate capture
 */
export async function createStripePayment({
  projectId,
  rewardId,
  addonIds,
  amount,
  userId,
}: CreatePaymentParams) {
  const stripeClient = await getStripeInstance();

  // Get project and creator's Stripe account
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      creator: {
        include: {
          stripeConfig: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.creator.stripeConfig?.stripeAccountId) {
    throw new Error("Creator has not connected Stripe");
  }

  // Get user email for Stripe customer
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  // Check if campaign is already funded
  const isCampaignFunded = project.currentAmount >= project.goalAmount;

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(
    stripeClient,
    userId,
    user?.email || ""
  );

  // Check for ANY existing pledge for this user/project to prevent duplicates
  // Users can only have ONE pledge per project (they can edit it, but not create multiple)
  const normalizedRewardId = rewardId && rewardId !== "no-reward" ? rewardId : null;

  // First check for completed pledges - these always block new pledges
  const existingCompletedPledge = await db.pledge.findFirst({
    where: {
      userId,
      projectId,
      status: "COMPLETED",
    },
  });

  if (existingCompletedPledge) {
    throw new Error("You have already backed this project. Visit your backer dashboard to manage your pledge.");
  }

  // Check for pending pledges with saved payment method - these also block new pledges
  const existingActivePendingPledge = await db.pledge.findFirst({
    where: {
      userId,
      projectId,
      status: "PENDING",
      stripePaymentMethodId: { not: null },
    },
  });

  if (existingActivePendingPledge) {
    throw new Error("You have already backed this project. Visit your backer dashboard to manage your pledge.");
  }

  // Check for any recent pending pledge with an active intent (checkout in progress)
  // This prevents race conditions where user clicks "Back" twice before first completes
  const existingCheckoutInProgress = await db.pledge.findFirst({
    where: {
      userId,
      projectId,
      status: "PENDING",
      stripePaymentMethodId: null,
      // Has an intent (checkout was started)
      OR: [
        { stripeSetupIntentId: { not: null } },
        { stripePaymentIntentId: { not: null } },
      ],
      // Created within last 30 minutes (active checkout session)
      createdAt: {
        gte: new Date(Date.now() - 30 * 60 * 1000),
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // If there's an active checkout, try to reuse it
  if (existingCheckoutInProgress) {
    // Retrieve the existing intent to check if it's still usable
    if (!isCampaignFunded && existingCheckoutInProgress.stripeSetupIntentId) {
      try {
        const setupIntent = await stripeClient.setupIntents.retrieve(existingCheckoutInProgress.stripeSetupIntentId);
        if (setupIntent.status === "requires_payment_method" || setupIntent.status === "requires_confirmation") {
          // Update the pledge with new amount/reward if different
          if (existingCheckoutInProgress.amount !== amount || existingCheckoutInProgress.rewardId !== normalizedRewardId) {
            await db.pledge.update({
              where: { id: existingCheckoutInProgress.id },
              data: { amount, rewardAmount: amount, rewardId: normalizedRewardId },
            });
          }
          return {
            type: "setup_intent" as const,
            clientSecret: setupIntent.client_secret,
            pledgeId: existingCheckoutInProgress.id,
            chargedImmediately: false,
          };
        }
        // If setupIntent succeeded, payment method should be saved soon
        // Block creating new pledge to avoid race condition
        if (setupIntent.status === "succeeded") {
          throw new Error("Your pledge is being processed. Please wait a moment and check your backer dashboard.");
        }
      } catch (e) {
        // If intent retrieval fails or is in terminal state, we can create a new pledge
        if (e instanceof Error && e.message.includes("pledge is being processed")) {
          throw e;
        }
        // Intent was canceled or invalid, continue to create new pledge
      }
    } else if (isCampaignFunded && existingCheckoutInProgress.stripePaymentIntentId) {
      try {
        const paymentIntent = await stripeClient.paymentIntents.retrieve(existingCheckoutInProgress.stripePaymentIntentId);
        if (paymentIntent.status === "requires_payment_method" || paymentIntent.status === "requires_confirmation") {
          return {
            type: "payment_intent" as const,
            clientSecret: paymentIntent.client_secret,
            pledgeId: existingCheckoutInProgress.id,
            chargedImmediately: true,
          };
        }
        // If paymentIntent is processing or succeeded, block new pledge
        if (paymentIntent.status === "processing" || paymentIntent.status === "succeeded") {
          throw new Error("Your pledge is being processed. Please wait a moment and check your backer dashboard.");
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("pledge is being processed")) {
          throw e;
        }
        // Intent was canceled or invalid, continue to create new pledge
      }
    }
  }

  // Check for old stale pending pledges (older than 30 min) to clean up
  // These can be reused if they still have valid intents
  const stalePendingPledge = await db.pledge.findFirst({
    where: {
      userId,
      projectId,
      status: "PENDING",
      stripePaymentMethodId: null,
      createdAt: {
        lt: new Date(Date.now() - 30 * 60 * 1000),
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Within last 24 hours
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // If there's a stale pending pledge, cancel its old intent and mark it cancelled
  if (stalePendingPledge) {
    if (stalePendingPledge.stripeSetupIntentId) {
      try {
        await stripeClient.setupIntents.cancel(stalePendingPledge.stripeSetupIntentId);
      } catch {
        // Ignore cancellation errors
      }
    }
    if (stalePendingPledge.stripePaymentIntentId) {
      try {
        await stripeClient.paymentIntents.cancel(stalePendingPledge.stripePaymentIntentId);
      } catch {
        // Ignore cancellation errors
      }
    }
    await db.pledge.update({
      where: { id: stalePendingPledge.id },
      data: { status: "CANCELLED", lastFailureReason: "Checkout abandoned, new pledge created" },
    });
  }

  // Create new pending pledge (no valid existing pledge found)
  const pledge = await db.pledge.create({
    data: {
      userId,
      projectId,
      rewardId: normalizedRewardId,
      amount,
      rewardAmount: amount,
      paymentProcessor: "STRIPE",
      status: "PENDING",
      stripeCustomerId: customerId,
      chargedImmediately: isCampaignFunded,
    },
  });

  // Create addon records if any
  if (addonIds.length > 0) {
    const addons = await db.reward.findMany({
      where: {
        id: { in: addonIds },
        type: "ADDON",
      },
      select: { id: true, amount: true },
    });

    await db.pledgeAddon.createMany({
      data: addons.map((addon) => ({
        pledgeId: pledge.id,
        addonId: addon.id,
        quantity: 1,
        amount: addon.amount,
      })),
    });
  }

  const amountInCents = Math.round(amount * 100);
  const platformFee = Math.round(amount * 0.03 * 100); // 3% platform fee

  if (isCampaignFunded) {
    // Campaign already funded - charge immediately
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      customer: customerId,
      application_fee_amount: platformFee,
      transfer_data: {
        destination: project.creator.stripeConfig.stripeAccountId,
      },
      metadata: {
        pledgeId: pledge.id,
        projectId,
        userId,
        chargeType: "immediate",
      },
      // Save the payment method for potential retries
      setup_future_usage: "off_session",
    });

    // Update pledge with payment intent ID
    await db.pledge.update({
      where: { id: pledge.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return {
      type: "payment_intent" as const,
      clientSecret: paymentIntent.client_secret,
      pledgeId: pledge.id,
      chargedImmediately: true,
    };
  } else {
    // Campaign not yet funded - save card for later using SetupIntent
    const setupIntent = await stripeClient.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        pledgeId: pledge.id,
        projectId,
        userId,
        amount: amountInCents.toString(),
        platformFee: platformFee.toString(),
        connectedAccountId: project.creator.stripeConfig.stripeAccountId,
      },
    });

    // Update pledge with setup intent ID
    await db.pledge.update({
      where: { id: pledge.id },
      data: { stripeSetupIntentId: setupIntent.id },
    });

    return {
      type: "setup_intent" as const,
      clientSecret: setupIntent.client_secret,
      pledgeId: pledge.id,
      chargedImmediately: false,
    };
  }
}

/**
 * Charge a pledge that was saved via SetupIntent
 * Called when campaign reaches its funding goal
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

  if (pledge.status !== "PENDING") {
    return false; // Already processed
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

  const connectedAccountId = pledge.project.creator.stripeConfig?.stripeAccountId;
  if (!connectedAccountId) {
    throw new Error("Creator has not connected Stripe");
  }

  const amountInCents = Math.round(pledge.amount * 100);
  const platformFee = Math.round(pledge.amount * 0.03 * 100);

  try {
    // Create PaymentIntent with saved payment method (off-session)
    const paymentIntent = await stripeClient.paymentIntents.create({
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
    });

    // Update pledge with payment intent ID
    await db.pledge.update({
      where: { id: pledgeId },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        // Status will be updated by webhook
      },
    });

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
async function schedulePaymentRetry(pledgeId: string, failureReason: string) {
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
        project: { select: { title: true, slug: true } },
      },
    });

    if (pledgeWithProject) {
      await notifyPledgeFailed(
        pledgeWithProject.projectId,
        pledgeWithProject.userId,
        pledgeWithProject.project.title,
        pledgeWithProject.project.slug
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
 */
export async function processPendingPledgesForProject(projectId: string) {
  const pendingPledges = await db.pledge.findMany({
    where: {
      projectId,
      status: "PENDING",
      chargedImmediately: false,
      stripePaymentMethodId: { not: null },
    },
  });

  const results = {
    total: pendingPledges.length,
    successful: 0,
    failed: 0,
  };

  for (const pledge of pendingPledges) {
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
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const pledgeId = paymentIntent.metadata.pledgeId;

  if (!pledgeId) return;

  // Save the payment method for potential future use
  const paymentMethodId = typeof paymentIntent.payment_method === "string"
    ? paymentIntent.payment_method
    : paymentIntent.payment_method?.id;

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

  // Only update project funding if this was an immediate charge (chargedImmediately = true)
  // Pledges made via SetupIntent (chargedImmediately = false) were already counted
  // when the SetupIntent succeeded, so we don't double-count them here
  let updatedProject = pledge.project;

  if (pledge.chargedImmediately) {
    // This was a direct PaymentIntent charge (campaign was already funded)
    updatedProject = await db.project.update({
      where: { id: pledge.projectId },
      data: {
        currentAmount: { increment: pledge.amount },
        backerCount: { increment: 1 },
      },
    });

    // Update reward quantity if limited (only if pledge has a reward)
    if (pledge.rewardId) {
      await db.reward.update({
        where: { id: pledge.rewardId },
        data: {
          quantityClaimed: { increment: 1 },
        },
      });
    }

    // Notify creator of new pledge
    await notifyPledgeReceived(
      pledge.projectId,
      pledge.project.creatorId,
      pledge.user.name || "A backer",
      pledge.amount
    );

    // Send confirmation email to backer
    await notifyBackerPledgeConfirmed(pledge.id, true);
  }

  // Check if project is now funded (only relevant for immediate charges on funded campaigns)
  if (pledge.chargedImmediately) {
    const projectIsFunded = updatedProject.currentAmount >= updatedProject.goalAmount;

    // Check if this pledge pushed it over the goal (for notification)
    const justReachedGoal = projectIsFunded &&
      updatedProject.currentAmount - pledge.amount < updatedProject.goalAmount;

    if (justReachedGoal) {
      // Project just reached its goal! Send notification
      await notifyProjectFunded(pledge.projectId);
    }

    // Always check for and process pending pledges if project is funded
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

  // Get the pledge to check if it's already been processed
  const existingPledge = await db.pledge.findUnique({
    where: { id: pledgeId },
    select: { stripePaymentMethodId: true, status: true },
  });

  // Skip if already processed (payment method already saved)
  if (existingPledge?.stripePaymentMethodId) return;

  // Save the payment method and get full pledge details
  const pledge = await db.pledge.update({
    where: { id: pledgeId },
    data: {
      stripePaymentMethodId: paymentMethodId,
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

  // Update project funding (pledged amount - even though not charged yet)
  // This shows momentum to other potential backers
  const updatedProject = await db.project.update({
    where: { id: pledge.projectId },
    data: {
      currentAmount: { increment: pledge.amount },
      backerCount: { increment: 1 },
    },
  });

  // Update reward quantity if limited (only if pledge has a reward)
  if (pledge.rewardId) {
    await db.reward.update({
      where: { id: pledge.rewardId },
      data: {
        quantityClaimed: { increment: 1 },
      },
    });
  }

  // Notify creator of new pledge
  await notifyPledgeReceived(
    pledge.projectId,
    pledge.project.creatorId,
    pledge.user.name || "A backer",
    pledge.amount
  );

  // Send confirmation email to backer (not charged yet, just card saved)
  await notifyBackerPledgeConfirmed(pledge.id, false);

  // Check if project is now funded (or was already funded)
  const projectIsFunded = updatedProject.currentAmount >= updatedProject.goalAmount;

  // Check if this pledge is the one that pushed it over the goal (for notification)
  const justReachedGoal = projectIsFunded &&
    updatedProject.currentAmount - pledge.amount < updatedProject.goalAmount;

  if (justReachedGoal) {
    // Project just reached its goal! Send notification
    await notifyProjectFunded(pledge.projectId);
  }

  // Always check for and process pending pledges if project is funded
  // This handles edge cases where webhooks were missed or processing failed
  if (projectIsFunded) {
    // Check if there are any pending pledges that need to be charged
    const pendingPledgeCount = await db.pledge.count({
      where: {
        projectId: pledge.projectId,
        status: "PENDING",
        chargedImmediately: false,
        stripePaymentMethodId: { not: null },
      },
    });

    if (pendingPledgeCount > 0) {
      // Process all pending pledges (charge saved cards)
      await processPendingPledgesForProject(pledge.projectId);
    }
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

export { stripe };
