import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";
import { notifyMarketplacePurchase, notifyMarketplaceSale } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace/checkout/verify
 *
 * Verify a Stripe Checkout session and complete the marketplace purchase
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    // Find purchase by checkout session ID
    const purchase = await prisma.marketplacePurchase.findFirst({
      where: {
        stripeCheckoutSessionId: sessionId,
        buyerId: session.user.id,
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            slug: true,
            companyId: true,
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    // If already completed, just return success
    if (purchase.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        bookTitle: purchase.book.title,
        message: "Purchase already completed",
      });
    }

    // Verify with Stripe
    const stripe = await getStripeInstance();
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (checkoutSession.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      );
    }

    // Complete the purchase atomically in a transaction
    await prisma.$transaction(async (tx) => {
      // Update purchase status
      await tx.marketplacePurchase.update({
        where: { id: purchase.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          deliveredAt: new Date(),
          stripePaymentIntentId: typeof checkoutSession.payment_intent === "string"
            ? checkoutSession.payment_intent
            : checkoutSession.payment_intent?.id,
        },
      });

      // Update book purchase count
      await tx.marketplaceBook.update({
        where: { id: purchase.bookId },
        data: {
          purchaseCount: { increment: 1 },
        },
      });

      // Update company total sales if applicable
      if (purchase.book.companyId) {
        await tx.companyProfile.update({
          where: { id: purchase.book.companyId },
          data: {
            totalSales: { increment: 1 },
          },
        });
      }
    });

    // Send notifications (don't await to avoid blocking the response)
    notifyMarketplacePurchase(purchase.id, "STRIPE").catch((err) =>
      console.error(`[CheckoutVerify] Failed to notify purchase ${purchase.id}:`, err)
    );
    notifyMarketplaceSale(purchase.id, "STRIPE").catch((err) =>
      console.error(`[CheckoutVerify] Failed to notify sale ${purchase.id}:`, err)
    );

    return NextResponse.json({
      success: true,
      bookTitle: purchase.book.title,
      message: "Purchase completed successfully",
      redirectUrl: "/dashboard/backer?tab=digital-library",
    });
  } catch (error) {
    console.error("Error verifying checkout session:", error);
    return NextResponse.json(
      { error: "Failed to verify purchase" },
      { status: 500 }
    );
  }
}
