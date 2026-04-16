import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const webhooksStripe_connectLogger = logger.child({ module: "webhooks-stripe_connect" });
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
    webhooksStripe_connectLogger.warn({ data: error }, "Could not fetch Stripe Connect settings from database:");
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
      webhooksStripe_connectLogger.error("Stripe Connect webhook secret not configured");
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
      webhooksStripe_connectLogger.error({ err: String(err) }, "Connect webhook signature verification failed:");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    webhooksStripe_connectLogger.info(`[Stripe Connect Webhook] Received event: ${event.type} (${event.id})`);

    // Check for duplicate event (idempotency)
    const existingEvent = await db.processedWebhookEvent.findUnique({
      where: { eventId: event.id },
    });

    if (existingEvent) {
      webhooksStripe_connectLogger.info(`[Stripe Connect Webhook] Duplicate event ignored: ${event.id}`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Record event BEFORE handling to prevent race conditions with retries
    try {
      await db.processedWebhookEvent.create({
        data: {
          eventId: event.id,
          eventType: event.type,
          source: "stripe_connect",
        },
      });
    } catch {
      webhooksStripe_connectLogger.info(`[Stripe Connect Webhook] Event already being processed: ${event.id}`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Handle Connect-specific events
    switch (event.type) {
      case "account.updated":
        await handleAccountUpdate(event.data.object as Stripe.Account);
        break;

      case "account.application.deauthorized":
        await handleAccountDeauthorized(event.data.object as Stripe.Application);
        break;

      default:
        webhooksStripe_connectLogger.info(`[Stripe Connect Webhook] Unhandled event type: ${event.type}`);
    }

    webhooksStripe_connectLogger.info(`[Stripe Connect Webhook] Successfully processed: ${event.type}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    webhooksStripe_connectLogger.error({ err: String(error) }, "Stripe Connect webhook error:");
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
  webhooksStripe_connectLogger.info(`[Connect Webhook] Handling account.updated for ${account.id}`);

  const isOnboarded = account.charges_enabled && account.payouts_enabled;

  // First, try to find in StripeConfig (user-level)
  const config = await db.stripeConfig.findFirst({
    where: { stripeAccountId: account.id, deletedAt: null },
  });

  if (config) {
    await db.stripeConfig.update({
      where: { id: config.id },
      data: { isOnboarded },
    });
    webhooksStripe_connectLogger.info(`[Connect Webhook] Updated StripeConfig onboarding status for account ${account.id}: ${isOnboarded}`);
    return;
  }

  // Fallback: Check if this account is linked to a project directly
  const project = await db.project.findFirst({
    where: { stripeAccountId: account.id, deletedAt: null },
    select: { id: true, title: true, creatorId: true },
  });

  if (project) {
    webhooksStripe_connectLogger.info(`[Connect Webhook] Account ${account.id} found on project "${project.title}" (${project.id})`);

    // Atomic upsert keyed on the userId @unique constraint. Previously a
    // findUnique → create branch would race two concurrent account.updated
    // events for the same creator and the second create would fail with
    // P2002 on the unique userId.
    await db.stripeConfig.upsert({
      where: { userId: project.creatorId },
      update: { stripeAccountId: account.id, isOnboarded },
      create: {
        userId: project.creatorId,
        stripeAccountId: account.id,
        isOnboarded,
      },
    });
    webhooksStripe_connectLogger.info(`[Connect Webhook] Upserted StripeConfig for creator ${project.creatorId}`);
    return;
  }

  webhooksStripe_connectLogger.info(`[Connect Webhook] No config or project found for account ${account.id}`);
}

/**
 * Handle account.application.deauthorized event
 * Cleans up when a user disconnects their Stripe account
 */
async function handleAccountDeauthorized(application: Stripe.Application) {
  webhooksStripe_connectLogger.info(`[Connect Webhook] Handling account.application.deauthorized`);

  // The application object contains info about the deauthorization
  // We need to find and update any affected accounts
  // Note: This event doesn't contain the account ID directly,
  // so we might need to handle this differently based on your use case

  webhooksStripe_connectLogger.info({ data: application.id }, `[Connect Webhook] Application deauthorized:`);
}
