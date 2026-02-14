import { NextRequest, NextResponse } from "next/server";
import {
  constructWebhookEvent,
  handleDivinityCoinWebhook,
  getDivinityCoinWebhookSecret,
  getDivinityCoinConfig,
} from "@/lib/payments/divinitycoin";

/**
 * POST /api/webhooks/divinitycoin
 *
 * Handle incoming webhook events from DivinityCoin.
 * Supports the following events:
 * - test.ping: Test webhook connectivity
 * - card.validate: Validate a gift card code
 * - card.redeem: Redeem a gift card code
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-webhook-signature");

    if (!signature) {
      console.error("[DivinityCoin Webhook] Missing signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Verify webhook secret is configured
    const webhookSecret = await getDivinityCoinWebhookSecret();
    if (!webhookSecret) {
      console.error("[DivinityCoin Webhook] Webhook secret not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Construct and verify the webhook event
    let event;
    try {
      event = await constructWebhookEvent(body, signature);
    } catch (err) {
      console.error("[DivinityCoin Webhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    console.log(`[DivinityCoin Webhook] Received event: ${event.event}`);

    // Handle the webhook event
    const response = await handleDivinityCoinWebhook(event);

    console.log(`[DivinityCoin Webhook] Successfully processed: ${event.event}`);
    return NextResponse.json(response);
  } catch (error) {
    console.error("[DivinityCoin Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/divinitycoin
 *
 * Returns information about the webhook endpoint and supported events.
 * Partners can use this to verify webhook configuration.
 */
export async function GET() {
  try {
    // Try to get config to check if DivinityCoin is properly configured
    let partnerId = "not_configured";
    let isConfigured = false;

    try {
      const config = await getDivinityCoinConfig();
      partnerId = config.partnerId || "unknown";
      isConfigured = true;
    } catch {
      // DivinityCoin not configured
    }

    return NextResponse.json({
      status: isConfigured ? "active" : "not_configured",
      partnerId,
      supportedEvents: [
        {
          event: "test.ping",
          description: "Test webhook connectivity",
          payloadRequired: false,
        },
        {
          event: "card.validate",
          description: "Validate a gift card code without redeeming",
          payloadRequired: true,
          payloadFormat: { cardCode: "string" },
        },
        {
          event: "card.redeem",
          description: "Redeem a gift card code",
          payloadRequired: true,
          payloadFormat: { cardCode: "string", platformUserId: "string (optional)" },
        },
        {
          event: "refund.request",
          description: "Request to refund/deduct DivinityCoin from a user's balance",
          payloadRequired: true,
          payloadFormat: {
            refundId: "string (required)",
            amount: "number (required)",
            originalCardCode: "string (required if no originalTransactionId)",
            originalTransactionId: "string (required if no originalCardCode)",
            reason: "string (optional)",
          },
        },
        {
          event: "payment.succeeded",
          description: "Payment completed via DC's Stripe account. Confirms the pledge or records upcharge.",
          payloadRequired: true,
          payloadFormat: {
            pledgeId: "string (required)",
            paymentId: "string (DC payment ID)",
            holdId: "string (DC hold ID)",
            amount: "number",
            type: "string ('initial' | 'upcharge')",
            originalPaymentId: "string (for upcharges, the original DC payment ID)",
            giftCardCode: "string (auto-generated card code)",
            stripePaymentIntentId: "string (DC's Stripe PI)",
          },
        },
        {
          event: "payment.failed",
          description: "Payment failed via DC's Stripe account. Marks pledge as failed.",
          payloadRequired: true,
          payloadFormat: {
            pledgeId: "string (required)",
            paymentId: "string (DC payment ID)",
            reason: "string (failure reason)",
          },
        },
        {
          event: "refund.completed",
          description: "Refund processed on DC's Stripe account. Marks pledge as refunded.",
          payloadRequired: true,
          payloadFormat: {
            pledgeId: "string (required)",
            paymentId: "string (DC payment ID)",
            refundId: "string (DC refund ID)",
            amount: "number",
          },
        },
      ],
      signatureHeader: "X-Webhook-Signature",
      signatureFormat: "t=timestamp,v1=hmac_sha256_signature",
      sandboxMode: process.env.NODE_ENV !== "production",
    });
  } catch (error) {
    console.error("[DivinityCoin Webhook] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to get webhook info" },
      { status: 500 }
    );
  }
}
