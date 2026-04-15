import { db } from "@/lib/db";
import {
  notifyPledgeReceived,
  notifyBackerPledgeConfirmed,
} from "@/lib/notifications";
import { assignBackerNumber, claimRewardSlot, claimAddonSlots } from "@/lib/payments/stripe";
import { circuitBreaker } from "@/lib/circuit-breaker";
import { getDivinityCoinConfig, paymentsDivinitycoinLogger } from "./config";
import type {
  DivinityCoinWebhookRequest,
  RefundRequestResponse,
  PaymentEventResponse,
} from "./types";

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

    const response = await circuitBreaker.execute("divinitycoin", () =>
      fetch(`${config.baseUrl}/webhooks/refund-failed`, {
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
      })
    );

    if (!response.ok) {
      paymentsDivinitycoinLogger.warn(`[DivinityCoin] Failed to notify about refund failure. ` +
        `Status: ${response.status}`);
    } else {
      paymentsDivinitycoinLogger.info(`[DivinityCoin] Successfully notified about refund failure: ${refundId}`);
    }
  } catch (error) {
    // Don't throw - this is a best-effort notification
    paymentsDivinitycoinLogger.warn({ data: error }, `[DivinityCoin] Error notifying about refund failure:`);
  }
}

/**
 * Safely extract a string identifier from a webhook field that may be:
 * - a string (return as-is)
 * - an object with an `id` field (return the id)
 * - an object without `id` (return JSON stringified)
 * - null/undefined (return undefined)
 */
export function extractId(value: unknown): string | undefined {
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
export function serializeField(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return "[unserializable]"; }
  }
  return String(value);
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
  paymentsDivinitycoinLogger.info(`[DivinityCoin] Refund request: ${refundId}, amount: ${amount}, ` +
    `cardCode: ${originalCardCode ? originalCardCode.substring(0, 4) + '****' : 'N/A'}, ` +
    `txnId: ${originalTransactionId || 'N/A'}`);

  // Validate amount
  if (!amount || amount <= 0) {
    paymentsDivinitycoinLogger.warn(`[DivinityCoin] Invalid refund amount: ${amount}`);
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
    paymentsDivinitycoinLogger.warn(`[DivinityCoin] No identifier provided to trace redemption`);
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
      paymentsDivinitycoinLogger.info(`[DivinityCoin] Found user ${userId} via card code lookup`);
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
      paymentsDivinitycoinLogger.info(`[DivinityCoin] Found user ${userId} via transaction ID lookup`);
    }
  }

  // If we couldn't find the user, return error
  if (!userId) {
    paymentsDivinitycoinLogger.warn(`[DivinityCoin] Could not find redemption for refund. ` +
      `cardCode: ${originalCardCode || 'N/A'}, txnId: ${originalTransactionId || 'N/A'}`);
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
    paymentsDivinitycoinLogger.warn(`[DivinityCoin] User ${userId} not found (but redemption exists)`);
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
    paymentsDivinitycoinLogger.info(`[DivinityCoin] Refund ${refundId} already processed`);
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
    paymentsDivinitycoinLogger.warn(`[DivinityCoin] Insufficient balance for refund. ` +
      `User ${userId} has ${previousBalance}, needs ${amount}`);

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

  // Process the refund inside a transaction that (1) locks the user
  // row with FOR UPDATE, (2) re-reads the current balance, (3) uses
  // an atomic decrement on divinityCoinBalance. Without this lock
  // two concurrent refunds would both read the same stale balance
  // and both write the same newBalance — losing one deduction.
  let newBalance = previousBalance;

  try {
    await db.$transaction(async (tx) => {
      // Lock the user row and re-read the balance inside the lock
      await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${userId!} FOR UPDATE`;
      const fresh = await tx.user.findUnique({
        where: { id: userId! },
        select: { divinityCoinBalance: true },
      });
      const freshBalance = Number(fresh?.divinityCoinBalance || 0);

      // Re-verify sufficient balance inside the lock
      if (freshBalance < amount) {
        throw new Error(`INSUFFICIENT_BALANCE_AT_REFUND:${freshBalance}`);
      }

      // Atomic decrement via Prisma's decrement operator (translates
      // to SQL `UPDATE ... SET balance = balance - $1`)
      const updated = await tx.user.update({
        where: { id: userId! },
        data: { divinityCoinBalance: { decrement: amount } },
        select: { divinityCoinBalance: true },
      });
      newBalance = Number(updated.divinityCoinBalance);

      // Create transaction record for audit
      await tx.divinityCoinTransaction.create({
        data: {
          userId: userId!,
          amount: -amount,
          type: "REFUND_DEDUCTION",
          description: reason || `DivinityCoin refund processed (Ref: ${refundId})`,
          metadata: JSON.stringify({
            refundId,
            originalCardCode: originalCardCode ? `${originalCardCode.substring(0, 4)}****` : null,
            originalTransactionId,
            originalRedemption: redemptionInfo,
            reason,
            previousBalance: freshBalance,
            newBalance,
            processedAt: new Date().toISOString(),
            source: "divinitycoin_webhook",
          }),
        },
      });
    });

    paymentsDivinitycoinLogger.info(`[DivinityCoin] Refund ${refundId} processed successfully. ` +
      `User ${userId}: ${previousBalance} -> ${newBalance}`);

    return {
      success: true,
      refundId,
      amountDeducted: amount,
      previousBalance,
      newBalance,
      userId,
    };
  } catch (error) {
    // Surface insufficient-balance-at-refund as a clean response
    // instead of a thrown exception.
    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_BALANCE_AT_REFUND:")) {
      const freshBalance = Number(error.message.split(":")[1] || 0);
      paymentsDivinitycoinLogger.warn(`[DivinityCoin] Refund ${refundId} blocked by concurrent deduction — fresh balance ${freshBalance} < required ${amount}`);
      await notifyDivinityCoinRefundFailed(refundId, userId, amount, freshBalance, originalCardCode, originalTransactionId);
      return {
        success: false,
        refundId,
        amountDeducted: 0,
        previousBalance: freshBalance,
        newBalance: freshBalance,
        userId,
        error: `Insufficient balance. User has ${freshBalance} DivinityCoin, refund requires ${amount}`,
        errorCode: "INSUFFICIENT_BALANCE",
      };
    }
    paymentsDivinitycoinLogger.error({ err: error }, `[DivinityCoin] Error processing refund ${refundId}:`);
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

  paymentsDivinitycoinLogger.info(`[DivinityCoin] Marketplace payment succeeded: purchase=${purchaseId}, payment=${paymentId || stripePI || "none"}`);

  try {
    const purchase = await db.marketplacePurchase.findUnique({
      where: { id: purchaseId },
      select: { id: true, status: true, bookId: true, buyerId: true, amount: true },
    });

    if (!purchase) {
      return { success: false, error: `Purchase ${purchaseId} not found` };
    }

    if (purchase.status !== "PENDING") {
      paymentsDivinitycoinLogger.info(`[DivinityCoin] Purchase ${purchaseId} already ${purchase.status}, skipping`);
      return { success: true, message: `Purchase already ${purchase.status}` };
    }

    // CAS on status PENDING → COMPLETED before any side effects.
    // Without this, two concurrent DC webhook deliveries (at-least-once
    // semantics) would both pass the findUnique "PENDING" check, both
    // flip status, both increment book.purchaseCount, and both create
    // DivinityCoinTransaction rows for the same purchase.
    const completeCas = await db.marketplacePurchase.updateMany({
      where: { id: purchaseId, status: "PENDING" },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        deliveredAt: new Date(),
        divinityCoinPaymentId: paymentId || stripePI || holdId || null,
      },
    });
    if (completeCas.count === 0) {
      paymentsDivinitycoinLogger.info(`[DivinityCoin] Purchase ${purchaseId} already processed by concurrent webhook, skipping side effects`);
      return { success: true, message: "Purchase already completed" };
    }

    await db.$transaction(async (tx) => {
      // Increment purchase count on the book (side effect only fires
      // for the webhook delivery that won the CAS above).
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

    paymentsDivinitycoinLogger.info(`[DivinityCoin] Purchase ${purchaseId} marked as COMPLETED via payment webhook`);
    return { success: true, message: "Purchase completed" };
  } catch (error) {
    paymentsDivinitycoinLogger.error({ err: error }, `[DivinityCoin] Error handling payment.succeeded for purchase ${purchaseId}:`);
    throw error;
  }
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
    paymentsDivinitycoinLogger.warn(`[DivinityCoin] Webhook payload missing payment references. Keys received: ${Object.keys(data).join(", ")}`);
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
  paymentsDivinitycoinLogger.info(`[DivinityCoin] Payment succeeded: pledge=${pledgeId}, payment=${paymentRef}${holdId ? `, hold=${holdId}` : ""}${paymentMethodStr ? `, method=${paymentMethodStr}` : ""}`);

  try {
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId , deletedAt: null },
      select: {
        id: true, status: true, projectId: true, amount: true, userId: true, metadata: true,
        rewardId: true,
        project: { select: { creatorId: true } },
        user: { select: { name: true } },
      },
    });

    if (!pledge) {
      return { success: false, error: `Pledge ${pledgeId} not found` };
    }

    const paymentType = data.type as string | undefined;

    // Handle upcharge payments for COMPLETED pledges (pledge modification or add-items)
    if (pledge.status === "COMPLETED" && paymentType === "upcharge") {
      paymentsDivinitycoinLogger.info(`[DivinityCoin] Upcharge payment for COMPLETED pledge ${pledgeId}`);

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

      paymentsDivinitycoinLogger.info(`[DivinityCoin] Upcharge payment recorded for pledge ${pledgeId}`);
      return { success: true, message: "Upcharge payment recorded" };
    }

    // Only process initial payments if the pledge is still PENDING
    if (pledge.status !== "PENDING") {
      paymentsDivinitycoinLogger.info(`[DivinityCoin] Pledge ${pledgeId} already ${pledge.status}, skipping`);
      return { success: true, message: `Pledge already ${pledge.status}` };
    }

    // CAS on status PENDING → COMPLETED before creating the
    // DivinityCoinTransaction record. Without this, DC's at-least-once
    // webhook delivery could fire this handler twice for the same
    // payment and create duplicate transaction records + double-charge
    // the chargedImmediately flag (the stats increment is already
    // separately CAS-guarded via confirmationEmailSent below).
    const pledgeCompleteCas = await db.pledge.updateMany({
      where: { id: pledgeId, status: "PENDING", deletedAt: null },
      data: {
        status: "COMPLETED",
        divinityCoinPaymentId: paymentId || stripePI || holdId || null,
        chargedImmediately: true,
      },
    });
    if (pledgeCompleteCas.count === 0) {
      paymentsDivinitycoinLogger.info(`[DivinityCoin] Pledge ${pledgeId} already processed by concurrent webhook, skipping transaction record`);
      return { success: true, message: "Pledge already completed" };
    }

    // Record the transaction — only fires for the webhook delivery
    // that actually flipped the pledge status above.
    await db.divinityCoinTransaction.create({
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

    paymentsDivinitycoinLogger.info(`[DivinityCoin] Pledge ${pledgeId} marked as COMPLETED via payment webhook`);

    // Atomically claim the right to update project stats using confirmationEmailSent.
    // This prevents double-counting between this webhook and the /confirm endpoint.
    // Both the flag set and the stats increment are in the same transaction so that
    // if the stats update fails, the flag rolls back and a retry can try again.
    const statsClaimResult = await db.$transaction(async (tx) => {
      const claimResult = await tx.pledge.updateMany({
        where: { id: pledgeId, confirmationEmailSent: false },
        data: { confirmationEmailSent: true },
      });
      if (claimResult.count > 0) {
        await tx.project.update({
          where: { id: pledge.projectId },
          data: {
            currentAmount: { increment: Number(pledge.amount) },
            backerCount: { increment: 1 },
          },
        });
      }
      return claimResult;
    });

    if (statsClaimResult.count > 0) {
      paymentsDivinitycoinLogger.info(`[DivinityCoin] Updated project stats for pledge ${pledgeId}: +$${pledge.amount}`);
      // Claim reward slot to prevent overselling (parallel to Stripe/PayPal)
      if (pledge.rewardId) {
        try {
          const claimed = await claimRewardSlot(pledge.rewardId);
          if (!claimed) {
            paymentsDivinitycoinLogger.warn(`[DivinityCoin] Reward ${pledge.rewardId} sold out for pledge ${pledgeId}`);
          }
        } catch (rewardErr) {
          paymentsDivinitycoinLogger.error({ err: rewardErr }, `[DivinityCoin] Failed to claim reward slot for pledge ${pledgeId}`);
        }
      }

      // Claim addon slots (prevents overselling limited addons)
      try {
        const pledgeAddons = await db.pledgeAddon.findMany({
          where: { pledgeId },
          select: { addonId: true, quantity: true },
        });
        if (pledgeAddons.length > 0) {
          const claimed = await claimAddonSlots(pledgeAddons.map((a: { addonId: string; quantity: number }) => ({ id: a.addonId, quantity: a.quantity })));
          if (!claimed) {
            paymentsDivinitycoinLogger.warn(`[DivinityCoin] One or more addons sold out for pledge ${pledgeId}`);
          }
        }
      } catch (addonErr) {
        paymentsDivinitycoinLogger.error({ err: addonErr }, `[DivinityCoin] Failed to claim addon slots for pledge ${pledgeId}`);
      }
    } else {
      paymentsDivinitycoinLogger.info(`[DivinityCoin] Stats already updated by /confirm for pledge ${pledgeId}, skipping stat update`);
    }

    // Notify creator of new pledge (non-blocking)
    try {
      await notifyPledgeReceived(
        pledge.projectId,
        pledge.project.creatorId,
        pledge.user?.name || "A backer",
        Number(pledge.amount)
      );
    } catch (notifyError) {
      paymentsDivinitycoinLogger.error({ err: notifyError }, `[DivinityCoin] Failed to notify creator for pledge ${pledgeId}:`);
    }

    // Assign backer number before sending confirmation email
    try {
      const backerNum = await assignBackerNumber(pledge.projectId, pledgeId);
      paymentsDivinitycoinLogger.info(`[DivinityCoin] Assigned backer number #${backerNum} to pledge ${pledgeId}`);
    } catch (bnError) {
      paymentsDivinitycoinLogger.error({ err: bnError }, `[DivinityCoin] Failed to assign backer number for pledge ${pledgeId}:`);
    }

    // Send confirmation email to backer (non-blocking)
    try {
      await notifyBackerPledgeConfirmed(pledge.id, true);
    } catch (emailError) {
      paymentsDivinitycoinLogger.error({ err: emailError }, `[DivinityCoin] Failed to send confirmation email for pledge ${pledgeId}:`);
    }

    return { success: true, message: "Pledge completed" };
  } catch (error) {
    paymentsDivinitycoinLogger.error({ err: error }, `[DivinityCoin] Error handling payment.succeeded for pledge ${pledgeId}:`);
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
    paymentsDivinitycoinLogger.info(`[DivinityCoin] Marketplace payment failed: purchase=${purchaseId}, payment=${paymentId}, reason=${reason}`);

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

      // CAS for idempotent webhook retries
      await db.marketplacePurchase.updateMany({
        where: { id: purchaseId, status: "PENDING" },
        data: { status: "FAILED" },
      });

      paymentsDivinitycoinLogger.info(`[DivinityCoin] Purchase ${purchaseId} marked as FAILED`);
      return { success: true, message: "Purchase marked as failed" };
    } catch (error) {
      paymentsDivinitycoinLogger.error({ err: error }, `[DivinityCoin] Error handling payment.failed for purchase ${purchaseId}:`);
      throw error;
    }
  }

  if (!pledgeId) {
    return { success: false, error: "pledgeId or purchaseId is required" };
  }

  paymentsDivinitycoinLogger.info(`[DivinityCoin] Payment failed: pledge=${pledgeId}, payment=${paymentId}, reason=${reason}`);

  try {
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId , deletedAt: null },
      select: { id: true, status: true },
    });

    if (!pledge) {
      return { success: false, error: `Pledge ${pledgeId} not found` };
    }

    if (pledge.status !== "PENDING") {
      return { success: true, message: `Pledge already ${pledge.status}` };
    }

    // CAS for idempotent webhook retries
    await db.pledge.updateMany({
      where: { id: pledgeId, status: "PENDING", deletedAt: null },
      data: {
        status: "FAILED",
        lastFailureReason: reason || "Payment failed via DivinityCoin",
      },
    });

    paymentsDivinitycoinLogger.info(`[DivinityCoin] Pledge ${pledgeId} marked as FAILED`);
    return { success: true, message: "Pledge marked as failed" };
  } catch (error) {
    paymentsDivinitycoinLogger.error({ err: error }, `[DivinityCoin] Error handling payment.failed for pledge ${pledgeId}:`);
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
    paymentsDivinitycoinLogger.info(`[DivinityCoin] Marketplace refund completed: purchase=${purchaseId}, refund=${refundId}, amount=${amount}`);

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

      // CAS on status COMPLETED → REFUNDED so webhook retries don't
      // double-decrement purchaseCount and create duplicate REFUND
      // transaction records.
      const wasCompleted = purchase.status === "COMPLETED";
      const refundCas = await db.marketplacePurchase.updateMany({
        where: { id: purchaseId, status: { not: "REFUNDED" } },
        data: {
          status: "REFUNDED",
          refundedAt: new Date(),
          refundReason: "Refund completed via DivinityCoin",
        },
      });
      if (refundCas.count === 0) {
        return { success: true, message: "Purchase already refunded by concurrent webhook" };
      }

      await db.$transaction(async (tx) => {
        // Decrement purchase count if was completed (only runs for
        // the webhook delivery that actually flipped the status).
        if (wasCompleted) {
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

      paymentsDivinitycoinLogger.info(`[DivinityCoin] Purchase ${purchaseId} marked as REFUNDED via webhook`);
      return { success: true, message: "Purchase refund recorded" };
    } catch (error) {
      paymentsDivinitycoinLogger.error({ err: error }, `[DivinityCoin] Error handling refund.completed for purchase ${purchaseId}:`);
      throw error;
    }
  }

  if (!pledgeId) {
    return { success: false, error: "pledgeId or purchaseId is required" };
  }

  paymentsDivinitycoinLogger.info(`[DivinityCoin] Refund completed: pledge=${pledgeId}, refund=${refundId}, amount=${amount}`);

  try {
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId , deletedAt: null },
      select: { id: true, status: true, userId: true, projectId: true, amount: true, rewardId: true, confirmationEmailSent: true },
    });

    if (!pledge) {
      return { success: false, error: `Pledge ${pledgeId} not found` };
    }

    // If already refunded, skip
    if (pledge.status === "REFUNDED") {
      return { success: true, message: "Pledge already refunded" };
    }

    // CAS on status → REFUNDED so webhook retries don't double-
    // decrement project stats and double-decrement reward slots.
    const pledgeRefundCas = await db.pledge.updateMany({
      where: { id: pledgeId, status: { not: "REFUNDED" }, deletedAt: null },
      data: {
        status: "REFUNDED",
        lastFailureReason: "Refund completed via DivinityCoin",
      },
    });
    if (pledgeRefundCas.count === 0) {
      return { success: true, message: "Pledge already refunded by concurrent webhook" };
    }

    await db.$transaction(async (tx) => {
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

      // Only decrement project stats if stats were previously counted
      if (pledge.confirmationEmailSent) {
        await tx.project.update({
          where: { id: pledge.projectId },
          data: {
            backerCount: { decrement: 1 },
            currentAmount: { decrement: Number(pledge.amount) },
          },
        });
      }
    });

    // Restore reward slot outside transaction (raw SQL not supported in array transactions)
    if (pledge.rewardId) {
      await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`;
    }

    paymentsDivinitycoinLogger.info(`[DivinityCoin] Pledge ${pledgeId} marked as REFUNDED via webhook`);
    return { success: true, message: "Refund recorded" };
  } catch (error) {
    paymentsDivinitycoinLogger.error({ err: error }, `[DivinityCoin] Error handling refund.completed for pledge ${pledgeId}:`);
    throw error;
  }
}
