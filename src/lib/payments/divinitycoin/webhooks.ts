import crypto from "crypto";
import { getDivinityCoinConfig, getDivinityCoinWebhookSecret, paymentsDivinitycoinLogger } from "./config";
import type {
  DivinityCoinWebhookRequest,
  TestPingResponse,
  CardValidateResponse,
  CardRedeemResponse,
  RefundRequestResponse,
  PaymentEventResponse,
} from "./types";
import { handleCardValidate, handleCardRedeem } from "./cards";
import {
  handleRefundRequest,
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleRefundCompleted,
} from "./payments";

/**
 * Verify webhook signature from DivinityCoin
 * Format: X-Webhook-Signature: t=timestamp,v1=hmac_signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Parse signature header: t=timestamp,v1=signature
  const parts = signature.split(",");
  const timestampPart = parts.find((p) => p.startsWith("t="));
  const signaturePart = parts.find((p) => p.startsWith("v1="));

  if (!timestampPart || !signaturePart) {
    paymentsDivinitycoinLogger.warn("[DivinityCoin] Invalid signature format");
    return false;
  }

  const timestamp = timestampPart.substring(2);
  const providedSignature = signaturePart.substring(3);

  // Check timestamp is within 5 minutes (300 seconds)
  const timestampAge = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (timestampAge > 300) {
    paymentsDivinitycoinLogger.warn({ timestampAge }, "DivinityCoin webhook timestamp too old");
    return false;
  }

  // Compute expected signature: HMAC-SHA256(timestamp.payload, secret)
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Construct and verify a webhook event
 */
export async function constructWebhookEvent(
  payload: string,
  signature: string
): Promise<DivinityCoinWebhookRequest> {
  const secret = await getDivinityCoinWebhookSecret();

  if (!secret) {
    throw new Error("DivinityCoin webhook secret not configured");
  }

  if (!verifyWebhookSignature(payload, signature, secret)) {
    throw new Error("Invalid webhook signature");
  }

  return JSON.parse(payload) as DivinityCoinWebhookRequest;
}

/**
 * Handle test.ping webhook event
 */
export async function handleTestPing(): Promise<TestPingResponse> {
  let partnerId = "unknown";
  try {
    const config = await getDivinityCoinConfig();
    partnerId = config.partnerId;
  } catch {
    // Config not available
  }

  return {
    success: true,
    message: "Webhook received successfully",
    partnerId,
    sandboxMode: process.env.NODE_ENV !== "production",
  };
}

/**
 * Main webhook event handler
 * Processes incoming webhook requests from DivinityCoin
 */
export async function handleDivinityCoinWebhook(
  request: DivinityCoinWebhookRequest
): Promise<TestPingResponse | CardValidateResponse | CardRedeemResponse | RefundRequestResponse | PaymentEventResponse> {
  // Note: event is already logged in the route handler — no duplicate log here

  switch (request.event) {
    case "test.ping":
      return handleTestPing();

    case "card.validate":
      if (!request.data?.cardCode) {
        return {
          valid: false,
          status: "error",
          amount: 0,
          error: "Card code is required",
        };
      }
      return handleCardValidate(request.data.cardCode);

    case "card.redeem":
      if (!request.data?.cardCode) {
        return {
          success: false,
          amount: 0,
          error: "Card code is required",
        };
      }
      return handleCardRedeem(
        request.data.cardCode,
        request.data.platformUserId
      );

    case "refund.request":
      if (!request.data?.refundId || !request.data?.amount) {
        return {
          success: false,
          refundId: request.data?.refundId || "unknown",
          amountDeducted: 0,
          previousBalance: 0,
          newBalance: 0,
          error: "Missing required fields: refundId and amount are required",
          errorCode: "INVALID_AMOUNT",
        };
      }
      if (!request.data?.originalCardCode && !request.data?.originalTransactionId) {
        return {
          success: false,
          refundId: request.data.refundId,
          amountDeducted: 0,
          previousBalance: 0,
          newBalance: 0,
          error: "Either originalCardCode or originalTransactionId is required to identify the redemption",
          errorCode: "REDEMPTION_NOT_FOUND",
        };
      }
      return handleRefundRequest(
        request.data.refundId,
        request.data.amount,
        request.data.originalCardCode,
        request.data.originalTransactionId,
        request.data.reason
      );

    case "payment.succeeded":
      if (!request.data) {
        return { success: false, error: "Payment data is required" };
      }
      return handlePaymentSucceeded(request.data);

    case "payment.failed":
      if (!request.data) {
        return { success: false, error: "Payment data is required" };
      }
      return handlePaymentFailed(request.data);

    case "refund.completed":
      if (!request.data) {
        return { success: false, error: "Refund data is required" };
      }
      return handleRefundCompleted(request.data);

    default:
      paymentsDivinitycoinLogger.warn(`[DivinityCoin Webhook] Unknown event type: ${request.event}`);
      return {
        success: false,
        amount: 0,
        error: `Unknown event type: ${request.event}`,
      } as CardRedeemResponse;
  }
}
