import { db } from "@/lib/db";
import crypto from "crypto";

// DivinityCoin API configuration
interface DivinityCoinConfig {
  apiKey: string;
  partnerId: string;
  webhookSecret: string;
  baseUrl: string;
}

let cachedConfig: DivinityCoinConfig | null = null;

/**
 * Get DivinityCoin configuration from database or environment
 */
export async function getDivinityCoinConfig(): Promise<DivinityCoinConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        divinityCoinApiKey: true,
        divinityCoinPartnerId: true,
        divinityCoinWebhookSecret: true,
        divinityCoinEnabled: true,
      },
    });

    if (settings?.divinityCoinEnabled && settings.divinityCoinApiKey) {
      cachedConfig = {
        apiKey: settings.divinityCoinApiKey,
        partnerId: settings.divinityCoinPartnerId || "",
        webhookSecret: settings.divinityCoinWebhookSecret || "",
        baseUrl: process.env.DIVINITYCOIN_API_URL || "https://api.divinitycoin.com/v1",
      };
      return cachedConfig;
    }
  } catch (error) {
    console.warn("Could not fetch DivinityCoin settings from database:", error);
  }

  // Fall back to environment variables
  if (process.env.DIVINITYCOIN_API_KEY) {
    cachedConfig = {
      apiKey: process.env.DIVINITYCOIN_API_KEY,
      partnerId: process.env.DIVINITYCOIN_PARTNER_ID || "",
      webhookSecret: process.env.DIVINITYCOIN_WEBHOOK_SECRET || "",
      baseUrl: process.env.DIVINITYCOIN_API_URL || "https://api.divinitycoin.com/v1",
    };
    return cachedConfig;
  }

  throw new Error("DivinityCoin not configured. Please set it in Admin Settings > Payments.");
}

/**
 * Get DivinityCoin webhook secret
 */
export async function getDivinityCoinWebhookSecret(): Promise<string | null> {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { divinityCoinWebhookSecret: true, divinityCoinEnabled: true },
    });

    if (settings?.divinityCoinWebhookSecret && settings.divinityCoinEnabled) {
      return settings.divinityCoinWebhookSecret;
    }
  } catch (error) {
    console.warn("Could not fetch DivinityCoin webhook secret from database:", error);
  }

  return process.env.DIVINITYCOIN_WEBHOOK_SECRET || null;
}

/**
 * Clear cached config (call when settings are updated)
 */
export function clearDivinityCoinConfigCache(): void {
  cachedConfig = null;
}

// Webhook event types supported by DivinityCoin
export type DivinityCoinEventType =
  | "test.ping"
  | "card.validate"
  | "card.redeem"
  | "refund.request";

// Webhook request structure from DivinityCoin
export interface DivinityCoinWebhookRequest {
  event: DivinityCoinEventType;
  data?: {
    cardCode?: string;
    platformUserId?: string;
    // Refund request fields
    refundId?: string;
    amount?: number;
    reason?: string;
    originalTransactionId?: string;
    [key: string]: unknown;
  };
}

// Webhook response structures
export interface TestPingResponse {
  success: true;
  message: string;
  partnerId: string;
  sandboxMode: boolean;
}

export interface CardValidateResponse {
  valid: boolean;
  status: string;
  amount: number;
  error?: string;
}

export interface CardRedeemResponse {
  success: boolean;
  amount: number;
  newBalance?: number;
  error?: string;
}

export interface RefundRequestResponse {
  success: boolean;
  refundId: string;
  amountDeducted: number;
  previousBalance: number;
  newBalance: number;
  error?: string;
  errorCode?: "INSUFFICIENT_BALANCE" | "USER_NOT_FOUND" | "INVALID_AMOUNT" | "ALREADY_PROCESSED";
}

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
    console.warn("[DivinityCoin] Invalid signature format");
    return false;
  }

  const timestamp = timestampPart.substring(2);
  const providedSignature = signaturePart.substring(3);

  // Check timestamp is within 5 minutes (300 seconds)
  const timestampAge = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (timestampAge > 300) {
    console.warn("[DivinityCoin] Webhook timestamp too old:", timestampAge, "seconds");
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
 * Handle card.validate webhook event
 * DivinityCoin calls this to check if a card code is valid
 */
export async function handleCardValidate(
  cardCode: string
): Promise<CardValidateResponse> {
  // TODO: Implement card validation logic based on your business rules
  // This is where you'd check if the card code is valid in your system
  console.log(`[DivinityCoin] Validating card: ${cardCode.substring(0, 4)}****`);

  // For now, return a placeholder response
  // You'll need to implement actual validation based on your requirements
  return {
    valid: true,
    status: "active",
    amount: 0,
  };
}

/**
 * Handle card.redeem webhook event
 * DivinityCoin calls this when a card is being redeemed
 */
export async function handleCardRedeem(
  cardCode: string,
  platformUserId?: string
): Promise<CardRedeemResponse> {
  console.log(
    `[DivinityCoin] Card redemption: ${cardCode.substring(0, 4)}****` +
    (platformUserId ? ` for user ${platformUserId}` : "")
  );

  // In sandbox mode, just acknowledge without actual redemption
  if (process.env.NODE_ENV !== "production") {
    return {
      success: true,
      amount: 0,
    };
  }

  // TODO: Implement actual card redemption logic
  // This is where you'd credit the user's account, update balances, etc.
  return {
    success: true,
    amount: 0,
  };
}

/**
 * Handle refund.request webhook event
 * DivinityCoin calls this when they need to refund coins from a user's balance.
 * We check if the user has sufficient balance before allowing the refund.
 */
export async function handleRefundRequest(
  refundId: string,
  platformUserId: string,
  amount: number,
  reason?: string,
  originalTransactionId?: string
): Promise<RefundRequestResponse> {
  console.log(
    `[DivinityCoin] Refund request: ${refundId} for user ${platformUserId}, amount: ${amount}`
  );

  // Validate amount
  if (!amount || amount <= 0) {
    console.warn(`[DivinityCoin] Invalid refund amount: ${amount}`);
    return {
      success: false,
      refundId,
      amountDeducted: 0,
      previousBalance: 0,
      newBalance: 0,
      error: "Invalid refund amount",
      errorCode: "INVALID_AMOUNT",
    };
  }

  // Find the user
  const user = await db.user.findUnique({
    where: { id: platformUserId },
    select: {
      id: true,
      divinityCoinBalance: true,
      email: true,
    },
  });

  if (!user) {
    console.warn(`[DivinityCoin] User not found: ${platformUserId}`);
    return {
      success: false,
      refundId,
      amountDeducted: 0,
      previousBalance: 0,
      newBalance: 0,
      error: `User not found: ${platformUserId}`,
      errorCode: "USER_NOT_FOUND",
    };
  }

  const previousBalance = Number(user.divinityCoinBalance || 0);

  // Check if this refund was already processed (idempotency check)
  const existingTransaction = await db.divinityCoinTransaction.findFirst({
    where: {
      userId: platformUserId,
      metadata: {
        contains: refundId,
      },
      type: "REFUND_DEDUCTION",
    },
  });

  if (existingTransaction) {
    console.log(`[DivinityCoin] Refund ${refundId} already processed`);
    return {
      success: false,
      refundId,
      amountDeducted: 0,
      previousBalance,
      newBalance: previousBalance,
      error: "Refund already processed",
      errorCode: "ALREADY_PROCESSED",
    };
  }

  // Check if user has sufficient balance
  if (previousBalance < amount) {
    console.warn(
      `[DivinityCoin] Insufficient balance for refund. ` +
      `User ${platformUserId} has ${previousBalance}, needs ${amount}`
    );

    // Notify DivinityCoin about insufficient balance via callback (if configured)
    await notifyDivinityCoinRefundFailed(refundId, platformUserId, amount, previousBalance);

    return {
      success: false,
      refundId,
      amountDeducted: 0,
      previousBalance,
      newBalance: previousBalance,
      error: `Insufficient balance. User has ${previousBalance} DivinityCoin, refund requires ${amount}`,
      errorCode: "INSUFFICIENT_BALANCE",
    };
  }

  // Process the refund - deduct coins from user's balance
  const newBalance = previousBalance - amount;

  try {
    await db.$transaction(async (tx) => {
      // Update user's balance
      await tx.user.update({
        where: { id: platformUserId },
        data: {
          divinityCoinBalance: newBalance,
        },
      });

      // Create transaction record for audit
      await tx.divinityCoinTransaction.create({
        data: {
          userId: platformUserId,
          amount: -amount, // Negative because it's a deduction
          type: "REFUND_DEDUCTION",
          description: reason || `DivinityCoin refund processed (Ref: ${refundId})`,
          metadata: JSON.stringify({
            refundId,
            originalTransactionId,
            reason,
            previousBalance,
            newBalance,
            processedAt: new Date().toISOString(),
            source: "divinitycoin_webhook",
          }),
        },
      });
    });

    console.log(
      `[DivinityCoin] Refund ${refundId} processed successfully. ` +
      `User ${platformUserId}: ${previousBalance} -> ${newBalance}`
    );

    return {
      success: true,
      refundId,
      amountDeducted: amount,
      previousBalance,
      newBalance,
    };
  } catch (error) {
    console.error(`[DivinityCoin] Error processing refund ${refundId}:`, error);
    throw error;
  }
}

/**
 * Notify DivinityCoin when a refund cannot be processed due to insufficient balance.
 * This allows DivinityCoin to take appropriate action (e.g., flag the account,
 * contact the user, or handle the refund differently).
 */
async function notifyDivinityCoinRefundFailed(
  refundId: string,
  platformUserId: string,
  requestedAmount: number,
  availableBalance: number
): Promise<void> {
  try {
    const config = await getDivinityCoinConfig();

    const response = await fetch(`${config.baseUrl}/webhooks/refund-failed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "X-Partner-ID": config.partnerId,
      },
      body: JSON.stringify({
        refundId,
        platformUserId,
        requestedAmount,
        availableBalance,
        shortfall: requestedAmount - availableBalance,
        timestamp: new Date().toISOString(),
        platform: "indiecrowdfund",
      }),
    });

    if (!response.ok) {
      console.warn(
        `[DivinityCoin] Failed to notify about refund failure. ` +
        `Status: ${response.status}`
      );
    } else {
      console.log(`[DivinityCoin] Successfully notified about refund failure: ${refundId}`);
    }
  } catch (error) {
    // Don't throw - this is a best-effort notification
    console.warn(`[DivinityCoin] Error notifying about refund failure:`, error);
  }
}

/**
 * Main webhook event handler
 * Processes incoming webhook requests from DivinityCoin
 */
export async function handleDivinityCoinWebhook(
  request: DivinityCoinWebhookRequest
): Promise<TestPingResponse | CardValidateResponse | CardRedeemResponse | RefundRequestResponse> {
  console.log(`[DivinityCoin Webhook] Received event: ${request.event}`);

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
      if (!request.data?.refundId || !request.data?.platformUserId || !request.data?.amount) {
        return {
          success: false,
          refundId: request.data?.refundId || "unknown",
          amountDeducted: 0,
          previousBalance: 0,
          newBalance: 0,
          error: "Missing required fields: refundId, platformUserId, and amount are required",
          errorCode: "INVALID_AMOUNT",
        };
      }
      return handleRefundRequest(
        request.data.refundId,
        request.data.platformUserId,
        request.data.amount,
        request.data.reason,
        request.data.originalTransactionId
      );

    default:
      console.warn(`[DivinityCoin Webhook] Unknown event type: ${request.event}`);
      return {
        success: false,
        amount: 0,
        error: `Unknown event type: ${request.event}`,
      } as CardRedeemResponse;
  }
}
