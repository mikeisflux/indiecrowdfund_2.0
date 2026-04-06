import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeInstance, getStripeWebhookSecret, handleStripeWebhook } from "@/lib/payments/stripe";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withCorrelation } from "@/lib/correlation";
import { metrics } from "@/lib/metrics";

const webhookLogger = logger.child({ module: "stripe-webhook" });

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

      const webhookSecret = await getStripeWebhookSecret();
      if (!webhookSecret) {
        webhookLogger.error({ correlationId }, "Stripe webhook secret not configured");
        return NextResponse.json(
          { error: "Webhook secret not configured" },
          { status: 500 }
        );
      }

      const stripeClient = await getStripeInstance();

      let event: Stripe.Event;

      try {
        event = stripeClient.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        webhookLogger.error({ correlationId, err: err instanceof Error ? err.message : String(err) }, "Webhook signature verification failed");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 400 }
        );
      }

      webhookLogger.info({ correlationId, eventType: event.type, eventId: event.id }, "Received Stripe webhook event");

      const existingEvent = await db.processedWebhookEvent.findUnique({
        where: { eventId: event.id },
      });

      if (existingEvent) {
        webhookLogger.info({ correlationId, eventId: event.id }, "Duplicate event ignored");
        return NextResponse.json({ received: true, duplicate: true });
      }

      try {
        await db.processedWebhookEvent.create({
          data: {
            eventId: event.id,
            eventType: event.type,
            source: "stripe",
          },
        });
      } catch {
        webhookLogger.info({ correlationId, eventId: event.id }, "Event already being processed");
        return NextResponse.json({ received: true, duplicate: true });
      }

      try {
        await handleStripeWebhook(event);
      } catch (handlerError) {
        // Return 200 even on handler errors — the dedup record is already written,
        // so retrying would just be deduped and silently dropped. Log for alerting.
        const durationSec = (Date.now() - startTime) / 1000;
        metrics.httpRequestsTotal.inc({ method: "POST", path: "/api/webhooks/stripe", status: "500" });
        metrics.httpRequestDuration.observe({ method: "POST", path: "/api/webhooks/stripe" }, durationSec);
        webhookLogger.error({ correlationId, eventType: event.type, err: handlerError instanceof Error ? handlerError.message : String(handlerError) }, "Stripe webhook handler error (event already deduped)");
        return NextResponse.json({ received: true, error: "Handler failed" });
      }

      const durationSec = (Date.now() - startTime) / 1000;
      metrics.httpRequestsTotal.inc({ method: "POST", path: "/api/webhooks/stripe", status: "200" });
      metrics.httpRequestDuration.observe({ method: "POST", path: "/api/webhooks/stripe" }, durationSec);
      webhookLogger.info({ correlationId, eventType: event.type, durationMs: Date.now() - startTime }, "Successfully processed webhook event");
      return NextResponse.json({ received: true });
    } catch (error) {
      const durationSec = (Date.now() - startTime) / 1000;
      metrics.httpRequestsTotal.inc({ method: "POST", path: "/api/webhooks/stripe", status: "500" });
      metrics.httpRequestDuration.observe({ method: "POST", path: "/api/webhooks/stripe" }, durationSec);
      webhookLogger.error({ correlationId, err: error instanceof Error ? error.message : String(error) }, "Stripe webhook error");
      return NextResponse.json(
        { error: "Webhook handler failed" },
        { status: 500 }
      );
    }
  });
}
