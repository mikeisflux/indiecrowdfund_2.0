import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeInstance, getStripeWebhookSecret, handleStripeWebhook } from "@/lib/payments/stripe";
import { db } from "@/lib/db";

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

    // Get webhook secret from database settings or env var
    const webhookSecret = await getStripeWebhookSecret();
    if (!webhookSecret) {
      console.error("Stripe webhook secret not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Get Stripe instance with database settings
    const stripeClient = await getStripeInstance();

    let event: Stripe.Event;

    try {
      event = stripeClient.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

    // Check for duplicate event (idempotency)
    const existingEvent = await db.processedWebhookEvent.findUnique({
      where: { eventId: event.id },
    });

    if (existingEvent) {
      console.log(`[Stripe Webhook] Duplicate event ignored: ${event.id}`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Record this event as processed BEFORE handling to prevent race conditions
    // If handling fails, the event will still be marked processed to prevent retries
    // from causing duplicate side effects. Stripe will retry anyway if we return non-200.
    try {
      await db.processedWebhookEvent.create({
        data: {
          eventId: event.id,
          eventType: event.type,
          source: "stripe",
        },
      });
    } catch {
      // If insert fails due to unique constraint, another request is processing this
      console.log(`[Stripe Webhook] Event already being processed: ${event.id}`);
      return NextResponse.json({ received: true, duplicate: true });
    }

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
