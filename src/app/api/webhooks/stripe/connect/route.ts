import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeInstance } from "@/lib/payments/stripe";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withCorrelation } from "@/lib/correlation";
import { metrics } from "@/lib/metrics";

const connectLogger = logger.child({ module: "stripe-connect-webhook" });

/**
 * Stripe Connect Webhook Handler
 *
 * Handles Connect-specific events like account.updated
 *
 * Configure in Stripe Dashboard:
 * 1. Go to Developers > Webhooks
 * 2. Add endpoint: https://yourdomain.com/api/webhooks/stripe/connect
 * 3. Select "Connect applications" events
 * 4. Add the webhook signing secret in Admin Settings > Payments
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
    connectLogger.warn({ err: error instanceof Error ? error.message : String(error) }, "Could not fetch Stripe Connect settings from database");
  }

  return process.env.STRIPE_CONNECT_WEBHOOK_SECRET || null;
}

export async function POST(req: NextRequest) {
  return withCorrelation(req, async (correlationId) => {
    const startTime = Date.now();
    try {
      const body = await req.text();
      const signature = req.headers.get("stripe-signature");

      if (!signature) {
        return NextResponse.json(
          { error: "Missing signature" },
          { status: 400 }
        );
      }

      const webhookSecret = await getStripeConnectWebhookSecret();
      if (!webhookSecret) {
        connectLogger.error({ correlationId }, "Stripe Connect webhook secret not configured");
        return NextResponse.json(
          { error: "Connect webhook secret not configured" },
          { status: 500 }
        );
      }

      const stripeClient = await getStripeInstance();

      let event: Stripe.Event;

      try {
        event = stripeClient.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        connectLogger.error({ correlationId, err: err instanceof Error ? err.message : String(err) }, "Connect webhook signature verification failed");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 400 }
        );
      }

      connectLogger.info({ correlationId, eventType: event.type, eventId: event.id }, "Received Stripe Connect webhook event");

      const existingEvent = await db.processedWebhookEvent.findUnique({
        where: { eventId: event.id },
      });

      if (existingEvent) {
        connectLogger.info({ correlationId, eventId: event.id }, "Duplicate event ignored");
        return NextResponse.json({ received: true, duplicate: true });
      }

      try {
        await db.processedWebhookEvent.create({
          data: {
            eventId: event.id,
            eventType: event.type,
            source: "stripe_connect",
          },
        });
      } catch {
        connectLogger.info({ correlationId, eventId: event.id }, "Event already being processed");
        return NextResponse.json({ received: true, duplicate: true });
      }

      switch (event.type) {
        case "account.updated":
          await handleAccountUpdate(event.data.object as Stripe.Account, correlationId);
          break;

        case "account.application.deauthorized":
          await handleAccountDeauthorized(event.data.object as Stripe.Application, correlationId);
          break;

        default:
          connectLogger.info({ correlationId, eventType: event.type }, "Unhandled Connect event type");
      }

      const durationSec = (Date.now() - startTime) / 1000;
      metrics.httpRequestsTotal.inc({ method: "POST", path: "/api/webhooks/stripe/connect", status: "200" });
      metrics.httpRequestDuration.observe({ method: "POST", path: "/api/webhooks/stripe/connect" }, durationSec);
      connectLogger.info({ correlationId, eventType: event.type, durationMs: Date.now() - startTime }, "Successfully processed Connect webhook event");
      return NextResponse.json({ received: true });
    } catch (error) {
      const durationSec = (Date.now() - startTime) / 1000;
      metrics.httpRequestsTotal.inc({ method: "POST", path: "/api/webhooks/stripe/connect", status: "500" });
      metrics.httpRequestDuration.observe({ method: "POST", path: "/api/webhooks/stripe/connect" }, durationSec);
      connectLogger.error({ correlationId, err: error instanceof Error ? error.message : String(error) }, "Stripe Connect webhook error");
      return NextResponse.json(
        { error: "Webhook handler failed" },
        { status: 500 }
      );
    }
  });
}

/**
 * Handle account.updated event
 * Updates the onboarding status when a connected account changes
 */
async function handleAccountUpdate(account: Stripe.Account, correlationId: string) {
  connectLogger.info({ correlationId, accountId: account.id }, "Handling account.updated");

  const config = await db.stripeConfig.findFirst({
    where: { stripeAccountId: account.id },
  });

  if (!config) {
    connectLogger.info({ correlationId, accountId: account.id }, "No config found for account");
    return;
  }

  const isOnboarded = account.charges_enabled && account.payouts_enabled;

  await db.stripeConfig.update({
    where: { id: config.id },
    data: { isOnboarded },
  });

  connectLogger.info({ correlationId, accountId: account.id, isOnboarded }, "Updated onboarding status");
}

/**
 * Handle account.application.deauthorized event
 * Cleans up when a user disconnects their Stripe account
 */
async function handleAccountDeauthorized(application: Stripe.Application, correlationId: string) {
  connectLogger.info({ correlationId, applicationId: application.id }, "Handling account.application.deauthorized");
}
