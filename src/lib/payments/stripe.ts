import Stripe from "stripe";
import { db } from "@/lib/db";

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-11-17.clover",
    });
  }
  return stripeInstance;
}

const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

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
  // Create Express account
  const account = await stripe.accounts.create({
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
  const accountLink = await stripe.accountLinks.create({
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

  // Calculate platform fee (5%)
  const platformFee = Math.round(amount * 0.05 * 100); // In cents
  const amountInCents = Math.round(amount * 100);

  // Create Payment Intent
  const paymentIntent = await stripe.paymentIntents.create({
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
      project: true,
      user: true,
    },
  });

  // Update project funding
  await db.project.update({
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
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const pledgeId = paymentIntent.metadata.pledgeId;

  if (!pledgeId) return;

  await db.pledge.update({
    where: { id: pledgeId },
    data: {
      status: "FAILED",
    },
  });
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
