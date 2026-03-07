import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminTransactionsStripeLookupLogger = logger.child({ module: "admin-transactions-stripe-lookup" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/transactions/stripe-lookup
 *
 * Look up a transaction directly from Stripe by payment intent ID, setup intent ID,
 * or checkout session ID. This provides raw Stripe data for debugging.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const lookupId = searchParams.get("id");

    if (!lookupId) {
      return NextResponse.json({ error: "id parameter required" }, { status: 400 });
    }

    const stripe = await getStripeInstance();

    // Determine type from prefix and look up
    if (lookupId.startsWith("pi_")) {
      // Payment Intent
      const paymentIntent = await stripe.paymentIntents.retrieve(lookupId, {
        expand: ["payment_method", "charges", "latest_charge"],
      });

      // Find matching pledge or marketplace purchase
      const matchingPledge = await db.pledge.findUnique({
        where: { stripePaymentIntentId: lookupId },
        select: { id: true, status: true, amount: true, userId: true },
      });

      const matchingPurchase = await db.marketplacePurchase.findFirst({
        where: { stripePaymentIntentId: lookupId },
        select: { id: true, status: true, amount: true, buyerId: true },
      });

      return NextResponse.json({
        lookupType: "payment_intent",
        stripe: {
          id: paymentIntent.id,
          object: paymentIntent.object,
          amount: paymentIntent.amount,
          amount_received: paymentIntent.amount_received,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          description: paymentIntent.description,
          customer: paymentIntent.customer,
          payment_method: paymentIntent.payment_method,
          latest_charge: paymentIntent.latest_charge ? {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            id: (paymentIntent.latest_charge as any).id || paymentIntent.latest_charge,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            status: (paymentIntent.latest_charge as any).status,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            failure_code: (paymentIntent.latest_charge as any).failure_code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            failure_message: (paymentIntent.latest_charge as any).failure_message,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            outcome: (paymentIntent.latest_charge as any).outcome,
          } : null,
          canceled_at: paymentIntent.canceled_at,
          cancellation_reason: paymentIntent.cancellation_reason,
          last_payment_error: paymentIntent.last_payment_error ? {
            code: paymentIntent.last_payment_error.code,
            message: paymentIntent.last_payment_error.message,
            type: paymentIntent.last_payment_error.type,
            decline_code: paymentIntent.last_payment_error.decline_code,
          } : null,
          metadata: paymentIntent.metadata,
          created: paymentIntent.created,
          livemode: paymentIntent.livemode,
        },
        databaseMatch: {
          pledge: matchingPledge ? {
            id: matchingPledge.id,
            status: matchingPledge.status,
            amount: Number(matchingPledge.amount),
          } : null,
          marketplacePurchase: matchingPurchase ? {
            id: matchingPurchase.id,
            status: matchingPurchase.status,
            amount: Number(matchingPurchase.amount),
          } : null,
        },
        diagnostics: {
          stripeStatus: paymentIntent.status,
          dbPledgeStatus: matchingPledge?.status || null,
          dbPurchaseStatus: matchingPurchase?.status || null,
          statusMismatch: matchingPledge
            ? !isStatusConsistent(paymentIntent.status, matchingPledge.status)
            : matchingPurchase
            ? !isStatusConsistent(paymentIntent.status, matchingPurchase.status)
            : null,
          amountInCents: paymentIntent.amount,
          amountInDollars: paymentIntent.amount / 100,
          amountReceivedInCents: paymentIntent.amount_received,
          isFullyPaid: paymentIntent.amount === paymentIntent.amount_received,
          hasError: !!paymentIntent.last_payment_error,
          errorDetail: paymentIntent.last_payment_error?.message || null,
          noDBRecord: !matchingPledge && !matchingPurchase,
        },
      });
    } else if (lookupId.startsWith("seti_")) {
      // Setup Intent
      const setupIntent = await stripe.setupIntents.retrieve(lookupId, {
        expand: ["payment_method"],
      });

      const matchingPledge = await db.pledge.findUnique({
        where: { stripeSetupIntentId: lookupId },
        select: { id: true, status: true, amount: true, userId: true },
      });

      return NextResponse.json({
        lookupType: "setup_intent",
        stripe: {
          id: setupIntent.id,
          object: setupIntent.object,
          status: setupIntent.status,
          description: setupIntent.description,
          customer: setupIntent.customer,
          payment_method: setupIntent.payment_method,
          last_setup_error: setupIntent.last_setup_error ? {
            code: setupIntent.last_setup_error.code,
            message: setupIntent.last_setup_error.message,
            type: setupIntent.last_setup_error.type,
            decline_code: setupIntent.last_setup_error.decline_code,
          } : null,
          metadata: setupIntent.metadata,
          created: setupIntent.created,
          livemode: setupIntent.livemode,
          usage: setupIntent.usage,
        },
        databaseMatch: {
          pledge: matchingPledge ? {
            id: matchingPledge.id,
            status: matchingPledge.status,
            amount: Number(matchingPledge.amount),
          } : null,
        },
        diagnostics: {
          stripeStatus: setupIntent.status,
          dbPledgeStatus: matchingPledge?.status || null,
          hasError: !!setupIntent.last_setup_error,
          errorDetail: setupIntent.last_setup_error?.message || null,
          noDBRecord: !matchingPledge,
          paymentMethodSaved: setupIntent.status === "succeeded",
        },
      });
    } else if (lookupId.startsWith("cs_")) {
      // Checkout Session
      const checkoutSession = await stripe.checkout.sessions.retrieve(lookupId, {
        expand: ["payment_intent", "line_items"],
      });

      const matchingPurchase = await db.marketplacePurchase.findFirst({
        where: { stripeCheckoutSessionId: lookupId },
        select: { id: true, status: true, amount: true, buyerId: true },
      });

      return NextResponse.json({
        lookupType: "checkout_session",
        stripe: {
          id: checkoutSession.id,
          object: checkoutSession.object,
          status: checkoutSession.status,
          payment_status: checkoutSession.payment_status,
          amount_total: checkoutSession.amount_total,
          amount_subtotal: checkoutSession.amount_subtotal,
          currency: checkoutSession.currency,
          customer: checkoutSession.customer,
          customer_email: checkoutSession.customer_email,
          payment_intent: checkoutSession.payment_intent,
          metadata: checkoutSession.metadata,
          created: checkoutSession.created,
          livemode: checkoutSession.livemode,
          expires_at: checkoutSession.expires_at,
        },
        databaseMatch: {
          marketplacePurchase: matchingPurchase ? {
            id: matchingPurchase.id,
            status: matchingPurchase.status,
            amount: Number(matchingPurchase.amount),
          } : null,
        },
        diagnostics: {
          stripePaymentStatus: checkoutSession.payment_status,
          dbPurchaseStatus: matchingPurchase?.status || null,
          noDBRecord: !matchingPurchase,
          isExpired: checkoutSession.status === "expired",
          isComplete: checkoutSession.status === "complete" && checkoutSession.payment_status === "paid",
        },
      });
    } else {
      // Try to find by generic ID - search across tables
      const pledge = await db.pledge.findFirst({
        where: {
          OR: [
            { id: lookupId },
            { stripePaymentIntentId: lookupId },
            { stripeSetupIntentId: lookupId },
            { divinityCoinPaymentId: lookupId },
          ],
        },
        select: {
          id: true,
          status: true,
          stripePaymentIntentId: true,
          stripeSetupIntentId: true,
        },
      });

      const purchase = await db.marketplacePurchase.findFirst({
        where: {
          OR: [
            { id: lookupId },
            { stripePaymentIntentId: lookupId },
            { stripeCheckoutSessionId: lookupId },
            { divinityCoinPaymentId: lookupId },
            { transactionId: lookupId },
          ],
        },
        select: {
          id: true,
          status: true,
          stripePaymentIntentId: true,
          stripeCheckoutSessionId: true,
        },
      });

      return NextResponse.json({
        lookupType: "generic_search",
        databaseMatch: {
          pledge: pledge ? {
            id: pledge.id,
            status: pledge.status,
            stripePaymentIntentId: pledge.stripePaymentIntentId,
            stripeSetupIntentId: pledge.stripeSetupIntentId,
          } : null,
          marketplacePurchase: purchase ? {
            id: purchase.id,
            status: purchase.status,
            stripePaymentIntentId: purchase.stripePaymentIntentId,
            stripeCheckoutSessionId: purchase.stripeCheckoutSessionId,
          } : null,
        },
        diagnostics: {
          noDBRecord: !pledge && !purchase,
          hint: "Provide a Stripe ID (pi_, seti_, cs_ prefix) for detailed Stripe lookup",
        },
      });
    }
  } catch (error) {
    adminTransactionsStripeLookupLogger.error({ err: String(error) }, "Error in Stripe lookup:");
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Stripe lookup failed: ${message}` },
      { status: 500 }
    );
  }
}

function isStatusConsistent(stripeStatus: string, dbStatus: string): boolean {
  const statusMap: Record<string, string[]> = {
    succeeded: ["COMPLETED"],
    requires_payment_method: ["PENDING", "FAILED"],
    requires_confirmation: ["PENDING"],
    requires_action: ["PENDING"],
    processing: ["PENDING"],
    canceled: ["CANCELLED", "REFUNDED"],
    requires_capture: ["PENDING"],
  };

  const expectedStatuses = statusMap[stripeStatus];
  if (!expectedStatuses) return true; // Unknown status, don't flag
  return expectedStatuses.includes(dbStatus);
}
