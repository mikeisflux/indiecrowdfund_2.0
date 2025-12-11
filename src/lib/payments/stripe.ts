import Stripe from "stripe";
import { db } from "@/lib/db";
import {
  notifyPledgeReceived,
  notifyPledgeFailed,
  notifyProjectFunded,
} from "@/lib/notifications";

let stripeInstance: Stripe | null = null;
let cachedSecretKey: string | null = null;

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
  rewardId: string;
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
  const accountLink = await stripeClient.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payment/stripe/refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payment/stripe/complete`,
    type: "account_onboarding",
  });

  return {
    accountId: account.id,
    onboardingUrl: accountLink.url,
  };
}

export async function createStripePayment({
  projectId,
  rewardId,
  addonIds,
  amount,
  userId,
}: CreatePaymentParams) {
  // Get Stripe instance with database settings
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

  // Create pending pledge
  const pledge = await db.pledge.create({
    data: {
      userId,
      projectId,
      rewardId,
      amount,
      rewardAmount: amount, // Simplified - would calculate separately in production
      paymentProcessor: "STRIPE",
      status: "PENDING",
    },
  });

  // Create addon records if any
  if (addonIds.length > 0) {
    // Fetch addon details to get their amounts
    const addons = await db.reward.findMany({
      where: {
        id: { in: addonIds },
        type: "ADDON",
      },
      select: { id: true, amount: true },
    });

    // Create PledgeAddon records
    await db.pledgeAddon.createMany({
      data: addons.map((addon) => ({
        pledgeId: pledge.id,
        addonId: addon.id,
        quantity: 1,
        amount: addon.amount,
      })),
    });
  }

  // Calculate platform fee (3%)
  const platformFee = Math.round(amount * 0.03 * 100); // In cents
  const amountInCents = Math.round(amount * 100);

  // Create Payment Intent
  const paymentIntent = await stripeClient.paymentIntents.create({
    amount: amountInCents,
    currency: "usd",
    application_fee_amount: platformFee,
    transfer_data: {
      destination: project.creator.stripeConfig.stripeAccountId,
    },
    metadata: {
      pledgeId: pledge.id,
      projectId,
      userId,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    pledgeId: pledge.id,
  };
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

    case "account.updated":
      await handleAccountUpdate(event.data.object as Stripe.Account);
      break;
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const pledgeId = paymentIntent.metadata.pledgeId;

  if (!pledgeId) return;

  const pledge = await db.pledge.update({
    where: { id: pledgeId },
    data: {
      status: "COMPLETED",
      stripePaymentIntentId: paymentIntent.id,
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

  // Update project funding
  const updatedProject = await db.project.update({
    where: { id: pledge.projectId },
    data: {
      currentAmount: { increment: pledge.amount },
      backerCount: { increment: 1 },
    },
  });

  // Update reward quantity if limited
  await db.reward.update({
    where: { id: pledge.rewardId },
    data: {
      quantityClaimed: { increment: 1 },
    },
  });

  // Notify creator of new pledge
  await notifyPledgeReceived(
    pledge.projectId,
    pledge.project.creatorId,
    pledge.user.name || "A backer",
    pledge.amount
  );

  // Check if project just got funded
  if (
    updatedProject.currentAmount >= updatedProject.goalAmount &&
    updatedProject.currentAmount - pledge.amount < updatedProject.goalAmount
  ) {
    // Project just reached its goal!
    await notifyProjectFunded(pledge.projectId);
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const pledgeId = paymentIntent.metadata.pledgeId;

  if (!pledgeId) return;

  const pledge = await db.pledge.update({
    where: { id: pledgeId },
    data: {
      status: "FAILED",
    },
    include: {
      project: {
        select: {
          title: true,
          slug: true,
        },
      },
    },
  });

  // Notify backer of failed pledge
  await notifyPledgeFailed(
    pledge.projectId,
    pledge.userId,
    pledge.project.title,
    pledge.project.slug
  );
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
