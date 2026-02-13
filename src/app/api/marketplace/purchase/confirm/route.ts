import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

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
    const { purchaseId } = body;

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

    // Mark purchase as completed
    await prisma.$transaction(async (tx) => {
      await tx.marketplacePurchase.update({
        where: { id: purchaseId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          deliveredAt: new Date(),
        },
      });

      // Increment purchase count on the book
      await tx.marketplaceBook.update({
        where: { id: purchase.bookId },
        data: {
          purchaseCount: { increment: 1 },
        },
      });
    });

    console.log(
      `[Marketplace] Purchase ${purchaseId} confirmed for user ${session.user.id}, book: ${purchase.book.title}`
    );

    return NextResponse.json({
      success: true,
      message: "Purchase confirmed",
    });
  } catch (error) {
    console.error("Error confirming purchase:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
