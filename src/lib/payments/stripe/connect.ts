import { db } from "@/lib/db";
import { getStripeInstance, getSecureAppUrl } from "./config";

import { logger } from "@/lib/logger";

const paymentsStripeConnectLogger = logger.child({ module: "payments-stripe-connect" });


/**
 * Check if a creator's Stripe account is onboarded, querying Stripe directly if needed.
 * This handles cases where the webhook might be delayed and updates the DB accordingly.
 */
export async function checkAndUpdateStripeOnboarding(stripeConfigId: string, stripeAccountId: string, currentOnboardedStatus: boolean): Promise<boolean> {
  // If already onboarded in DB, return true
  if (currentOnboardedStatus) {
    return true;
  }

  // Query Stripe directly to check current status
  try {
    const stripeClient = await getStripeInstance();
    const account = await stripeClient.accounts.retrieve(stripeAccountId);

    const isOnboarded = account.charges_enabled && account.payouts_enabled;

    if (isOnboarded) {
      // Update database since webhook might have been delayed
      await db.stripeConfig.update({
        where: { id: stripeConfigId },
        data: { isOnboarded: true },
      });
      return true;
    }

    return false;
  } catch (error) {
    // Handle revoked/invalid Stripe Connect accounts gracefully
    const stripeErr = error as { type?: string; code?: string; message?: string };
    if (stripeErr.type === "StripePermissionError" || stripeErr.code === "account_invalid") {
      paymentsStripeConnectLogger.warn(`[Stripe Connect] Account ${stripeAccountId} access revoked or invalid, marking as inactive`);
      try {
        await db.stripeConfig.update({
          where: { id: stripeConfigId },
          data: { isOnboarded: false, isActive: false },
        });
      } catch { /* ignore update failure */ }
      return false;
    }
    paymentsStripeConnectLogger.error({ err: stripeErr.message || error }, "Error checking Stripe account status:");
    // Return DB value if Stripe check fails
    return currentOnboardedStatus;
  }
}

/**
 * Validate that a user has a fully onboarded Stripe Connect account.
 * Used as a safeguard before launching projects or publishing marketplace products.
 * Returns { isValid: true } if the account is ready to receive payments,
 * or { isValid: false, error: string } with a descriptive error message.
 */
export async function validateStripeConnectAccount(userId: string): Promise<{ isValid: boolean; error?: string }> {
  try {
    // Get user's Stripe config
    const stripeConfig = await db.stripeConfig.findUnique({
      where: { userId },
      select: {
        id: true,
        stripeAccountId: true,
        isOnboarded: true,
        isActive: true,
      },
    });

    // No Stripe account at all
    if (!stripeConfig) {
      return {
        isValid: false,
        error: "Stripe Connect account not set up. Please connect your Stripe account in Settings before proceeding.",
      };
    }

    // Account exists but not active
    if (!stripeConfig.isActive) {
      return {
        isValid: false,
        error: "Your Stripe Connect account is inactive. Please check your Stripe account status.",
      };
    }

    // Check onboarding status (query Stripe if needed)
    const isOnboarded = await checkAndUpdateStripeOnboarding(
      stripeConfig.id,
      stripeConfig.stripeAccountId,
      stripeConfig.isOnboarded
    );

    if (!isOnboarded) {
      return {
        isValid: false,
        error: "Stripe Connect onboarding is incomplete. Please complete your Stripe account setup to receive payments.",
      };
    }

    return { isValid: true };
  } catch (error) {
    paymentsStripeConnectLogger.error({ err: error }, "Error validating Stripe Connect account:");
    return {
      isValid: false,
      error: "Unable to verify Stripe account status. Please try again.",
    };
  }
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
