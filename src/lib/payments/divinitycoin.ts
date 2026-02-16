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
        baseUrl: process.env.DIVINITYCOIN_API_URL || "https://divinitycoin.com/internal",
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
      baseUrl: process.env.DIVINITYCOIN_API_URL || "https://divinitycoin.com/internal",
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
  | "refund.request"
  | "payment.succeeded"
  | "payment.failed"
  | "refund.completed";

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
    originalTransactionId?: string; // DivinityCoin's transaction ID from when the card was redeemed
    originalCardCode?: string; // The card code that was redeemed
    // Payment event fields (new seamless flow)
    paymentId?: string; // DC's internal payment ID
    pledgeId?: string; // IndieK's pledge ID
    projectId?: string;
    holdId?: string; // DC's hold ID for credits
    stripePaymentIntentId?: string; // DC's Stripe PI ID
    giftCardCode?: string; // Auto-generated gift card (for compliance)
    email?: string;
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
  userId?: string; // The user whose balance was affected
  error?: string;
  errorCode?: "INSUFFICIENT_BALANCE" | "USER_NOT_FOUND" | "REDEMPTION_NOT_FOUND" | "INVALID_AMOUNT" | "ALREADY_PROCESSED";
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
 *
 * Since DivinityCoin doesn't know our user IDs, we trace the user by looking up
 * the original redemption using either:
 * - originalCardCode: The card code that was redeemed
 * - originalTransactionId: DivinityCoin's transaction ID from when the card was redeemed
 *
 * We then check if the user has sufficient balance before allowing the refund.
 */
export async function handleRefundRequest(
  refundId: string,
  amount: number,
  originalCardCode?: string,
  originalTransactionId?: string,
  reason?: string
): Promise<RefundRequestResponse> {
  console.log(
    `[DivinityCoin] Refund request: ${refundId}, amount: ${amount}, ` +
    `cardCode: ${originalCardCode ? originalCardCode.substring(0, 4) + '****' : 'N/A'}, ` +
    `txnId: ${originalTransactionId || 'N/A'}`
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

  // Must have at least one identifier to trace the redemption
  if (!originalCardCode && !originalTransactionId) {
    console.warn(`[DivinityCoin] No identifier provided to trace redemption`);
    return {
      success: false,
      refundId,
      amountDeducted: 0,
      previousBalance: 0,
      newBalance: 0,
      error: "Either originalCardCode or originalTransactionId is required to identify the redemption",
      errorCode: "REDEMPTION_NOT_FOUND",
    };
  }

  // Try to find the user who redeemed this card
  let userId: string | null = null;
  let redemptionInfo: { code: string; amount: number; redeemedAt: Date } | null = null;

  // Method 1: Look up by card code in DivinityCoinRedemption table
  if (originalCardCode) {
    const cleanCode = originalCardCode.replace(/[-\s]/g, "").toUpperCase();
    const redemption = await db.divinityCoinRedemption.findUnique({
      where: { code: cleanCode },
      select: {
        userId: true,
        code: true,
        amount: true,
        redeemedAt: true,
      },
    });

    if (redemption) {
      userId = redemption.userId;
      redemptionInfo = {
        code: redemption.code,
        amount: Number(redemption.amount),
        redeemedAt: redemption.redeemedAt,
      };
      console.log(`[DivinityCoin] Found user ${userId} via card code lookup`);
    }
  }

  // Method 2: If not found by code, try looking up by external transaction ID in metadata
  if (!userId && originalTransactionId) {
    const transaction = await db.divinityCoinTransaction.findFirst({
      where: {
        type: "REDEMPTION",
        metadata: {
          contains: originalTransactionId,
        },
      },
      select: {
        userId: true,
        amount: true,
        createdAt: true,
        metadata: true,
      },
    });

    if (transaction) {
      userId = transaction.userId;

      // Try to extract code from metadata
      let codeInfo = "unknown";
      try {
        const metadata = JSON.parse(transaction.metadata || "{}");
        if (metadata.codePrefix && metadata.codeSuffix) {
          codeInfo = `${metadata.codePrefix}****${metadata.codeSuffix}`;
        } else if (metadata.codePrefix) {
          codeInfo = `${metadata.codePrefix}****`;
        }
      } catch {
        // Ignore parse errors
      }

      redemptionInfo = {
        code: codeInfo,
        amount: Number(transaction.amount),
        redeemedAt: transaction.createdAt,
      };
      console.log(`[DivinityCoin] Found user ${userId} via transaction ID lookup`);
    }
  }

  // If we couldn't find the user, return error
  if (!userId) {
    console.warn(
      `[DivinityCoin] Could not find redemption for refund. ` +
      `cardCode: ${originalCardCode || 'N/A'}, txnId: ${originalTransactionId || 'N/A'}`
    );
    return {
      success: false,
      refundId,
      amountDeducted: 0,
      previousBalance: 0,
      newBalance: 0,
      error: "Could not find the original redemption. The card code or transaction ID may be invalid.",
      errorCode: "REDEMPTION_NOT_FOUND",
    };
  }

  // Get the user's current balance
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      divinityCoinBalance: true,
      email: true,
    },
  });

  if (!user) {
    // This shouldn't happen if we found a redemption, but handle it anyway
    console.warn(`[DivinityCoin] User ${userId} not found (but redemption exists)`);
    return {
      success: false,
      refundId,
      amountDeducted: 0,
      previousBalance: 0,
      newBalance: 0,
      userId,
      error: `User account not found`,
      errorCode: "USER_NOT_FOUND",
    };
  }

  const previousBalance = Number(user.divinityCoinBalance || 0);

  // Check if this refund was already processed (idempotency check)
  const existingRefund = await db.divinityCoinTransaction.findFirst({
    where: {
      metadata: {
        contains: refundId,
      },
      type: "REFUND_DEDUCTION",
    },
  });

  if (existingRefund) {
    console.log(`[DivinityCoin] Refund ${refundId} already processed`);
    return {
      success: false,
      refundId,
      amountDeducted: 0,
      previousBalance,
      newBalance: previousBalance,
      userId,
      error: "Refund already processed",
      errorCode: "ALREADY_PROCESSED",
    };
  }

  // Check if user has sufficient balance
  if (previousBalance < amount) {
    console.warn(
      `[DivinityCoin] Insufficient balance for refund. ` +
      `User ${userId} has ${previousBalance}, needs ${amount}`
    );

    // Notify DivinityCoin about insufficient balance via callback (if configured)
    await notifyDivinityCoinRefundFailed(refundId, userId, amount, previousBalance, originalCardCode, originalTransactionId);

    return {
      success: false,
      refundId,
      amountDeducted: 0,
      previousBalance,
      newBalance: previousBalance,
      userId,
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
        where: { id: userId! },
        data: {
          divinityCoinBalance: newBalance,
        },
      });

      // Create transaction record for audit
      await tx.divinityCoinTransaction.create({
        data: {
          userId: userId!,
          amount: -amount, // Negative because it's a deduction
          type: "REFUND_DEDUCTION",
          description: reason || `DivinityCoin refund processed (Ref: ${refundId})`,
          metadata: JSON.stringify({
            refundId,
            originalCardCode: originalCardCode ? `${originalCardCode.substring(0, 4)}****` : null,
            originalTransactionId,
            originalRedemption: redemptionInfo,
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
      `User ${userId}: ${previousBalance} -> ${newBalance}`
    );

    return {
      success: true,
      refundId,
      amountDeducted: amount,
      previousBalance,
      newBalance,
      userId,
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
  availableBalance: number,
  originalCardCode?: string,
  originalTransactionId?: string
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
        originalCardCode: originalCardCode ? `${originalCardCode.substring(0, 4)}****` : null,
        originalTransactionId,
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

// Response for payment events
export interface PaymentEventResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Safely extract a string identifier from a webhook field that may be:
 * - a string (return as-is)
 * - an object with an `id` field (return the id)
 * - an object without `id` (return JSON stringified)
 * - null/undefined (return undefined)
 */
function extractId(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.id === "string") return obj.id;
    // Return first string-valued field as fallback
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === "string") return obj[key];
    }
  }
  return String(value);
}

/**
 * Safely serialize a webhook field for logging/metadata.
 * Objects get JSON stringified, strings pass through.
 */
function serializeField(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return "[unserializable]"; }
  }
  return String(value);
}

/**
 * Handle payment.succeeded webhook event
 * DivinityCoin calls this when a payment (via their Stripe) has succeeded.
 * This confirms the pledge or marketplace purchase and marks it as completed.
 */
export async function handlePaymentSucceeded(
  data: NonNullable<DivinityCoinWebhookRequest["data"]>
): Promise<PaymentEventResponse> {
  // DC uses varying field names — check all known variants
  const pledgeId = data.pledgeId || (data.pledge_id as string | undefined);
  const paymentId = data.paymentId || (data.payment_id as string | undefined)
    || (data.paymentIntentId as string | undefined); // DC sends this
  // DC sends "hold" as an object { id, amount, ... }, not a string
  const holdId = data.holdId || (data.hold_id as string | undefined)
    || extractId(data.hold);
  const giftCardCode = data.giftCardCode || (data.gift_card_code as string | undefined)
    || extractId(data.giftCard); // DC sends "giftCard" — may be string or object
  const purchaseId = (data.purchaseId || data.purchase_id) as string | undefined;
  const stripePI = data.stripePaymentIntentId || (data.stripe_payment_intent_id as string | undefined)
    || (data.paymentIntentId as string | undefined); // DC uses paymentIntentId for Stripe PI
  // DC sends "paymentMethod" as an object { type, card, ... }, not a string
  const paymentMethodStr = serializeField(data.paymentMethod);

  // Log full payload keys for debugging when no payment reference was resolved
  if (!paymentId && !holdId && !stripePI) {
    console.warn(
      `[DivinityCoin] Webhook payload missing payment references. Keys received: ${Object.keys(data).join(", ")}`
    );
  }

  // Handle marketplace purchase if purchaseId is provided
  if (purchaseId) {
    return handleMarketplacePaymentSucceeded(data, purchaseId);
  }

  if (!pledgeId) {
    return { success: false, error: "pledgeId or purchaseId is required" };
  }

  // Use best available payment reference
  const paymentRef = paymentId || stripePI || "none";
  console.log(
    `[DivinityCoin] Payment succeeded: pledge=${pledgeId}, payment=${paymentRef}${holdId ? `, hold=${holdId}` : ""}${paymentMethodStr ? `, method=${paymentMethodStr}` : ""}`
  );

  try {
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      select: { id: true, status: true, projectId: true, amount: true, userId: true, metadata: true },
    });

    if (!pledge) {
      return { success: false, error: `Pledge ${pledgeId} not found` };
    }

    const paymentType = data.type as string | undefined;

    // Handle upcharge payments for COMPLETED pledges (pledge modification or add-items)
    if (pledge.status === "COMPLETED" && paymentType === "upcharge") {
      console.log(`[DivinityCoin] Upcharge payment for COMPLETED pledge ${pledgeId}`);

      const metadata = (typeof pledge.metadata === "object" && pledge.metadata !== null)
        ? pledge.metadata as Record<string, unknown>
        : {};

      // Record the upcharge transaction (actual modification is applied via confirm-modify/confirm-add-items)
      await db.divinityCoinTransaction.create({
        data: {
          userId: pledge.userId,
          pledgeId: pledge.id,
          amount: data.amount ? Number(data.amount) / 100 : 0, // DC sends cents
          type: "PAYMENT",
          description: `Upcharge payment for pledge modification via DivinityCoin`,
          metadata: JSON.stringify({
            paymentId: paymentId || null,
            holdId: holdId || null,
            type: "upcharge",
            originalPaymentId: data.originalPaymentId || null,
            giftCardCode: giftCardCode ? `${String(giftCardCode).substring(0, 4)}****` : null,
            stripePaymentIntentId: stripePI || null,
            paymentMethod: paymentMethodStr || null,
            holdRaw: serializeField(data.hold),
            hasPendingModification: !!metadata.pendingModification,
            hasPendingAdditionalItems: !!metadata.pendingAdditionalItems,
            processedAt: new Date().toISOString(),
            source: "divinitycoin_webhook",
          }),
        },
      });

      console.log(`[DivinityCoin] Upcharge payment recorded for pledge ${pledgeId}`);
      return { success: true, message: "Upcharge payment recorded" };
    }

    // Only process initial payments if the pledge is still PENDING
    if (pledge.status !== "PENDING") {
      console.log(`[DivinityCoin] Pledge ${pledgeId} already ${pledge.status}, skipping`);
      return { success: true, message: `Pledge already ${pledge.status}` };
    }

    await db.$transaction(async (tx) => {
      // Mark pledge as completed (use best available payment reference)
      await tx.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "COMPLETED",
          divinityCoinPaymentId: paymentId || stripePI || holdId || null,
          chargedImmediately: true,
        },
      });

      // Update project stats
      await tx.project.update({
        where: { id: pledge.projectId },
        data: {
          currentAmount: { increment: pledge.amount },
          backerCount: { increment: 1 },
        },
      });

      // Record the transaction
      await tx.divinityCoinTransaction.create({
        data: {
          userId: pledge.userId,
          pledgeId: pledge.id,
          amount: Number(pledge.amount),
          type: "PAYMENT",
          description: `Payment for pledge via DivinityCoin`,
          metadata: JSON.stringify({
            paymentId: paymentId || null,
            holdId: holdId || null,
            giftCardCode: giftCardCode ? `${String(giftCardCode).substring(0, 4)}****` : null,
            stripePaymentIntentId: stripePI || null,
            paymentMethod: paymentMethodStr || null,
            holdRaw: serializeField(data.hold),
            processedAt: new Date().toISOString(),
            source: "divinitycoin_webhook",
          }),
        },
      });
    });

    console.log(`[DivinityCoin] Pledge ${pledgeId} marked as COMPLETED via payment webhook`);
    return { success: true, message: "Pledge completed" };
  } catch (error) {
    console.error(`[DivinityCoin] Error handling payment.succeeded for pledge ${pledgeId}:`, error);
    throw error;
  }
}

/**
 * Handle payment.succeeded for marketplace purchases
 * Confirms the purchase, increments purchase count, and delivers the book.
 */
async function handleMarketplacePaymentSucceeded(
  data: NonNullable<DivinityCoinWebhookRequest["data"]>,
  purchaseId: string
): Promise<PaymentEventResponse> {
  // DC uses varying field names — check all known variants (hold/giftCard may be objects)
  const paymentId = data.paymentId || (data.payment_id as string | undefined)
    || (data.paymentIntentId as string | undefined);
  const holdId = data.holdId || (data.hold_id as string | undefined)
    || extractId(data.hold);
  const giftCardCode = data.giftCardCode || (data.gift_card_code as string | undefined)
    || extractId(data.giftCard);
  const stripePI = data.stripePaymentIntentId || (data.stripe_payment_intent_id as string | undefined)
    || (data.paymentIntentId as string | undefined);

  console.log(
    `[DivinityCoin] Marketplace payment succeeded: purchase=${purchaseId}, payment=${paymentId || stripePI || "none"}`
  );

  try {
    const purchase = await db.marketplacePurchase.findUnique({
      where: { id: purchaseId },
      select: { id: true, status: true, bookId: true, buyerId: true, amount: true },
    });

    if (!purchase) {
      return { success: false, error: `Purchase ${purchaseId} not found` };
    }

    if (purchase.status !== "PENDING") {
      console.log(`[DivinityCoin] Purchase ${purchaseId} already ${purchase.status}, skipping`);
      return { success: true, message: `Purchase already ${purchase.status}` };
    }

    await db.$transaction(async (tx) => {
      // Mark purchase as completed
      await tx.marketplacePurchase.update({
        where: { id: purchaseId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          deliveredAt: new Date(),
          divinityCoinPaymentId: paymentId || stripePI || holdId || null,
        },
      });

      // Increment purchase count on the book
      await tx.marketplaceBook.update({
        where: { id: purchase.bookId },
        data: {
          purchaseCount: { increment: 1 },
        },
      });

      // Record the transaction
      await tx.divinityCoinTransaction.create({
        data: {
          userId: purchase.buyerId,
          amount: Number(purchase.amount),
          type: "PAYMENT",
          description: `Marketplace purchase via DivinityCoin`,
          metadata: JSON.stringify({
            purchaseId,
            bookId: purchase.bookId,
            paymentId,
            holdId,
            giftCardCode: giftCardCode ? `${String(giftCardCode).substring(0, 4)}****` : null,
            stripePaymentIntentId: stripePI || null,
            holdRaw: serializeField(data.hold),
            paymentMethod: serializeField(data.paymentMethod),
            processedAt: new Date().toISOString(),
            source: "divinitycoin_webhook",
          }),
        },
      });
    });

    console.log(`[DivinityCoin] Purchase ${purchaseId} marked as COMPLETED via payment webhook`);
    return { success: true, message: "Purchase completed" };
  } catch (error) {
    console.error(`[DivinityCoin] Error handling payment.succeeded for purchase ${purchaseId}:`, error);
    throw error;
  }
}

/**
 * Handle payment.failed webhook event
 * DivinityCoin calls this when a payment fails (e.g. card declined).
 */
export async function handlePaymentFailed(
  data: NonNullable<DivinityCoinWebhookRequest["data"]>
): Promise<PaymentEventResponse> {
  const { pledgeId, paymentId, reason } = data;
  const purchaseId = data.purchaseId as string | undefined;

  // Handle marketplace purchase failure
  if (purchaseId) {
    console.log(
      `[DivinityCoin] Marketplace payment failed: purchase=${purchaseId}, payment=${paymentId}, reason=${reason}`
    );

    try {
      const purchase = await db.marketplacePurchase.findUnique({
        where: { id: purchaseId },
        select: { id: true, status: true },
      });

      if (!purchase) {
        return { success: false, error: `Purchase ${purchaseId} not found` };
      }

      if (purchase.status !== "PENDING") {
        return { success: true, message: `Purchase already ${purchase.status}` };
      }

      await db.marketplacePurchase.update({
        where: { id: purchaseId },
        data: { status: "FAILED" },
      });

      console.log(`[DivinityCoin] Purchase ${purchaseId} marked as FAILED`);
      return { success: true, message: "Purchase marked as failed" };
    } catch (error) {
      console.error(`[DivinityCoin] Error handling payment.failed for purchase ${purchaseId}:`, error);
      throw error;
    }
  }

  if (!pledgeId) {
    return { success: false, error: "pledgeId or purchaseId is required" };
  }

  console.log(
    `[DivinityCoin] Payment failed: pledge=${pledgeId}, payment=${paymentId}, reason=${reason}`
  );

  try {
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      select: { id: true, status: true },
    });

    if (!pledge) {
      return { success: false, error: `Pledge ${pledgeId} not found` };
    }

    if (pledge.status !== "PENDING") {
      return { success: true, message: `Pledge already ${pledge.status}` };
    }

    await db.pledge.update({
      where: { id: pledgeId },
      data: {
        status: "FAILED",
        lastFailureReason: reason || "Payment failed via DivinityCoin",
      },
    });

    console.log(`[DivinityCoin] Pledge ${pledgeId} marked as FAILED`);
    return { success: true, message: "Pledge marked as failed" };
  } catch (error) {
    console.error(`[DivinityCoin] Error handling payment.failed for pledge ${pledgeId}:`, error);
    throw error;
  }
}

/**
 * Handle refund.completed webhook event
 * DivinityCoin calls this when a refund has been processed on their end
 * (e.g. Stripe refund completed for a card payment).
 */
export async function handleRefundCompleted(
  data: NonNullable<DivinityCoinWebhookRequest["data"]>
): Promise<PaymentEventResponse> {
  const { pledgeId, paymentId, refundId, amount } = data;
  const purchaseId = data.purchaseId as string | undefined;

  // Handle marketplace purchase refund
  if (purchaseId) {
    console.log(
      `[DivinityCoin] Marketplace refund completed: purchase=${purchaseId}, refund=${refundId}, amount=${amount}`
    );

    try {
      const purchase = await db.marketplacePurchase.findUnique({
        where: { id: purchaseId },
        select: { id: true, status: true, buyerId: true, bookId: true, amount: true },
      });

      if (!purchase) {
        return { success: false, error: `Purchase ${purchaseId} not found` };
      }

      if (purchase.status === "REFUNDED") {
        return { success: true, message: "Purchase already refunded" };
      }

      await db.$transaction(async (tx) => {
        await tx.marketplacePurchase.update({
          where: { id: purchaseId },
          data: {
            status: "REFUNDED",
            refundedAt: new Date(),
            refundReason: "Refund completed via DivinityCoin",
          },
        });

        // Decrement purchase count if was completed
        if (purchase.status === "COMPLETED") {
          await tx.marketplaceBook.update({
            where: { id: purchase.bookId },
            data: {
              purchaseCount: { decrement: 1 },
            },
          });
        }

        await tx.divinityCoinTransaction.create({
          data: {
            userId: purchase.buyerId,
            amount: -(amount || Number(purchase.amount)),
            type: "REFUND",
            description: `Marketplace refund via DivinityCoin`,
            metadata: JSON.stringify({
              purchaseId,
              bookId: purchase.bookId,
              paymentId,
              refundId,
              processedAt: new Date().toISOString(),
              source: "divinitycoin_webhook",
            }),
          },
        });
      });

      console.log(`[DivinityCoin] Purchase ${purchaseId} marked as REFUNDED via webhook`);
      return { success: true, message: "Purchase refund recorded" };
    } catch (error) {
      console.error(`[DivinityCoin] Error handling refund.completed for purchase ${purchaseId}:`, error);
      throw error;
    }
  }

  if (!pledgeId) {
    return { success: false, error: "pledgeId or purchaseId is required" };
  }

  console.log(
    `[DivinityCoin] Refund completed: pledge=${pledgeId}, refund=${refundId}, amount=${amount}`
  );

  try {
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      select: { id: true, status: true, userId: true, projectId: true, amount: true },
    });

    if (!pledge) {
      return { success: false, error: `Pledge ${pledgeId} not found` };
    }

    // If already refunded, skip
    if (pledge.status === "REFUNDED") {
      return { success: true, message: "Pledge already refunded" };
    }

    await db.$transaction(async (tx) => {
      // Mark pledge as refunded
      await tx.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "REFUNDED",
          lastFailureReason: "Refund completed via DivinityCoin",
        },
      });

      // Record the refund transaction
      await tx.divinityCoinTransaction.create({
        data: {
          userId: pledge.userId,
          pledgeId: pledge.id,
          amount: -(amount || Number(pledge.amount)),
          type: "REFUND",
          description: `Refund completed via DivinityCoin`,
          metadata: JSON.stringify({
            paymentId,
            refundId,
            processedAt: new Date().toISOString(),
            source: "divinitycoin_webhook",
          }),
        },
      });

      // Only decrement project stats if pledge was COMPLETED
      if (pledge.status === "COMPLETED") {
        await tx.project.update({
          where: { id: pledge.projectId },
          data: {
            backerCount: { decrement: 1 },
            currentAmount: { decrement: pledge.amount },
          },
        });
      }
    });

    console.log(`[DivinityCoin] Pledge ${pledgeId} marked as REFUNDED via webhook`);
    return { success: true, message: "Refund recorded" };
  } catch (error) {
    console.error(`[DivinityCoin] Error handling refund.completed for pledge ${pledgeId}:`, error);
    throw error;
  }
}

/**
 * Call DivinityCoin Partner API
 * Used for making outbound API calls to DC (refund, release, capture, etc.)
 */
export async function callDivinityCoinAPI(
  action: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const config = await getDivinityCoinConfig();

    const response = await fetch(`${config.baseUrl}?action=${action}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "X-Partner-ID": config.partnerId,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`[DivinityCoin API] ${action} failed:`, result);
      return {
        success: false,
        error: result.error || `DC API ${action} failed with status ${response.status}`,
      };
    }

    return { success: true, data: result };
  } catch (error) {
    console.error(`[DivinityCoin API] ${action} error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "DivinityCoin API call failed",
    };
  }
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
      console.warn(`[DivinityCoin Webhook] Unknown event type: ${request.event}`);
      return {
        success: false,
        amount: 0,
        error: `Unknown event type: ${request.event}`,
      } as CardRedeemResponse;
  }
}
