import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeInstance } from "@/lib/payments/stripe";
import { db } from "@/lib/db";

/**
 * Stripe Connect Webhook Handler
 *
 * Handles Connect-specific events like account.updated
 *
 * Configure in Stripe Dashboard:
 * 1. Go to Developers > Webhooks
 * 2. Add endpoint: https://indiecrowdfund.com/api/webhooks/stripe_connect
 * 3. Select "Listen to events on Connected accounts"
 * 4. Subscribe to: account.updated, account.application.deauthorized
 * 5. Add the webhook signing secret in Admin Settings > Payments > Connect Webhook Secret
 */

// Get Connect webhook secret from database settings or fall back to env var
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
    console.warn("Could not fetch Stripe Connect settings from database:", error);
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

    // Get Connect webhook secret from database settings or env var
    const webhookSecret = await getStripeConnectWebhookSecret();
    if (!webhookSecret) {
      console.error("Stripe Connect webhook secret not configured");
      return NextResponse.json(
        { error: "Connect webhook secret not configured" },
        { status: 500 }
      );
    }

    // Get Stripe instance with database settings
    const stripeClient = await getStripeInstance();

    let event: Stripe.Event;

    try {
      event = stripeClient.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Connect webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    console.log(`[Stripe Connect Webhook] Received event: ${event.type} (${event.id})`);

    // Handle Connect-specific events
    switch (event.type) {
      case "account.updated":
        await handleAccountUpdate(event.data.object as Stripe.Account);
        break;

      case "account.application.deauthorized":
        await handleAccountDeauthorized(event.data.object as Stripe.Application);
        break;

      default:
        console.log(`[Stripe Connect Webhook] Unhandled event type: ${event.type}`);
    }

    console.log(`[Stripe Connect Webhook] Successfully processed: ${event.type}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe Connect webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle account.updated event
 * Updates the onboarding status when a connected account changes
 */
async function handleAccountUpdate(account: Stripe.Account) {
  console.log(`[Connect Webhook] Handling account.updated for ${account.id}`);

  const isOnboarded = account.charges_enabled && account.payouts_enabled;

  // First, try to find in StripeConfig (user-level)
  const config = await db.stripeConfig.findFirst({
    where: { stripeAccountId: account.id },
  });

  if (config) {
    await db.stripeConfig.update({
      where: { id: config.id },
      data: { isOnboarded },
    });
    console.log(`[Connect Webhook] Updated StripeConfig onboarding status for account ${account.id}: ${isOnboarded}`);
    return;
  }

  // Fallback: Check if this account is linked to a project directly
  const project = await db.project.findFirst({
    where: { stripeAccountId: account.id },
    select: { id: true, title: true, creatorId: true },
  });

  if (project) {
    console.log(`[Connect Webhook] Account ${account.id} found on project "${project.title}" (${project.id})`);

    // Try to create/update StripeConfig for the project's creator
    const existingConfig = await db.stripeConfig.findUnique({
      where: { userId: project.creatorId },
    });

    if (existingConfig) {
      await db.stripeConfig.update({
        where: { id: existingConfig.id },
        data: { stripeAccountId: account.id, isOnboarded },
      });
      console.log(`[Connect Webhook] Updated existing StripeConfig for creator ${project.creatorId}`);
    } else {
      await db.stripeConfig.create({
        data: {
          userId: project.creatorId,
          stripeAccountId: account.id,
          isOnboarded,
        },
      });
      console.log(`[Connect Webhook] Created StripeConfig for creator ${project.creatorId}`);
    }
    return;
  }

  console.log(`[Connect Webhook] No config or project found for account ${account.id}`);
}

/**
 * Handle account.application.deauthorized event
 * Cleans up when a user disconnects their Stripe account
 */
async function handleAccountDeauthorized(application: Stripe.Application) {
  console.log(`[Connect Webhook] Handling account.application.deauthorized`);

  // The application object contains info about the deauthorization
  // We need to find and update any affected accounts
  // Note: This event doesn't contain the account ID directly,
  // so we might need to handle this differently based on your use case

  console.log(`[Connect Webhook] Application deauthorized:`, application.id);
}
