import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeInstance, getStripeWebhookSecret, handleStripeWebhook } from "@/lib/payments/stripe";
import { db } from "@/lib/db";

/**
 * Get Connect webhook secret from database settings or fall back to env var
 * Used as fallback for Connect-specific events like account.updated
 */
async function getStripeConnectWebhookSecret(): Promise<string | null> {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { stripeConnectWebhookSecret: true, stripeEnabled: true },
    });

    if (settings?.stripeConnectWebhookSecret && settings.stripeEnabled) {
      return settings.stripeConnectWebhookSecret;
    }
  } catch (error) {
    console.warn("Could not fetch Stripe Connect webhook secret from database:", error);
  }

  return process.env.STRIPE_CONNECT_WEBHOOK_SECRET || null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Get Stripe instance with database settings
    const stripeClient = await getStripeInstance();

    // Get webhook secrets - try both regular and Connect secrets
    const regularWebhookSecret = await getStripeWebhookSecret();
    const connectWebhookSecret = await getStripeConnectWebhookSecret();

    if (!regularWebhookSecret && !connectWebhookSecret) {
      console.error("Stripe webhook secret not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    let event: Stripe.Event | null = null;
    let verifiedWith: "regular" | "connect" | null = null;

    // Try regular webhook secret first
    if (regularWebhookSecret) {
      try {
        event = stripeClient.webhooks.constructEvent(body, signature, regularWebhookSecret);
        verifiedWith = "regular";
      } catch (err) {
        // Regular secret failed, will try Connect secret next
        console.log("[Stripe Webhook] Regular webhook secret verification failed, trying Connect secret...");
      }
    }

    // If regular failed and we have a Connect secret, try that
    if (!event && connectWebhookSecret) {
      try {
        event = stripeClient.webhooks.constructEvent(body, signature, connectWebhookSecret);
        verifiedWith = "connect";
        console.log("[Stripe Webhook] Verified with Connect webhook secret");
      } catch (err) {
        console.error("Connect webhook signature verification also failed:", err);
      }
    }

    // If neither worked, return error
    if (!event) {
      console.error("Webhook signature verification failed with both secrets");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id}) - verified with ${verifiedWith} secret`);

    await handleStripeWebhook(event);

    console.log(`[Stripe Webhook] Successfully processed: ${event.type}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
