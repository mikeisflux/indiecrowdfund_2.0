import Stripe from "stripe";
import { db } from "@/lib/db";

let stripeInstance: Stripe | null = null;
let cachedSecretKey: string | null = null;

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
export async function getStripeInstance(): Promise<Stripe> {
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

export { stripe };
