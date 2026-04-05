import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const marketplacePurchaseConfirmLogger = logger.child({ module: "marketplace-purchase-confirm" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketplace/purchase/confirm
 *
 * Confirm a marketplace purchase after Stripe payment succeeds on the client side.
 * This is called by the frontend after Stripe.confirmPayment() succeeds.
 * The DC webhook will also handle this, but this provides immediate feedback.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { purchaseId, paymentIntentId } = body;

    if (!purchaseId) {
      return NextResponse.json({ error: "purchaseId is required" }, { status: 400 });
    }

    // Find the purchase and verify ownership
    const purchase = await prisma.marketplacePurchase.findUnique({
      where: { id: purchaseId },
      include: {
        book: {
          select: { id: true, title: true, purchaseCount: true },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    if (purchase.buyerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // If already completed, just return success
    if (purchase.status === "COMPLETED") {
      return NextResponse.json({ success: true, message: "Purchase already completed" });
    }

    // Only confirm PENDING purchases
    if (purchase.status !== "PENDING") {
      return NextResponse.json(
        { error: `Purchase is ${purchase.status}, cannot confirm` },
        { status: 400 }
      );
    }

    // For paid Stripe purchases, verify the payment intent actually succeeded
    // This prevents bypassing payment by calling /confirm without paying
    if (Number(purchase.amount) > 0 && purchase.paymentProcessor === "STRIPE") {
      if (!paymentIntentId) {
        return NextResponse.json({ error: "paymentIntentId is required for Stripe purchases" }, { status: 400 });
      }
      try {
        const stripe = await getStripeInstance();
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (intent.status !== "succeeded") {
          return NextResponse.json({ error: "Payment not confirmed by Stripe" }, { status: 400 });
        }
        const expectedCents = Math.round(Number(purchase.amount) * 100);
        if (intent.amount !== expectedCents) {
          marketplacePurchaseConfirmLogger.warn({ purchaseId, expectedCents, actualCents: intent.amount }, "Payment amount mismatch");
          return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
        }
      } catch (stripeError) {
        marketplacePurchaseConfirmLogger.error({ err: String(stripeError) }, "Failed to verify Stripe payment intent");
        return NextResponse.json({ error: "Failed to verify payment" }, { status: 500 });
      }
    }

    // Mark purchase as completed atomically - use updateMany with status guard
    // to prevent race condition where two concurrent requests both increment purchaseCount
    const updated = await prisma.marketplacePurchase.updateMany({
      where: { id: purchaseId, status: "PENDING" },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        deliveredAt: new Date(),
        // Store verified payment intent ID for audit trail
        ...(paymentIntentId && purchase.paymentProcessor === "STRIPE"
          ? { stripePaymentIntentId: paymentIntentId }
          : {}),
      },
    });

    if (updated.count === 0) {
      // Another request already confirmed this purchase
      return NextResponse.json({ success: true, message: "Purchase already completed" });
    }

    // Only increment purchase count if we actually flipped the status
    await prisma.marketplaceBook.update({
      where: { id: purchase.bookId },
      data: {
        purchaseCount: { increment: 1 },
      },
    });

    marketplacePurchaseConfirmLogger.info(`[Marketplace] Purchase ${purchaseId} confirmed for user ${session.user.id}, book: ${purchase.book.title}`);

    return NextResponse.json({
      success: true,
      message: "Purchase confirmed",
    });
  } catch (error) {
    marketplacePurchaseConfirmLogger.error({ err: String(error) }, "Error confirming purchase:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
