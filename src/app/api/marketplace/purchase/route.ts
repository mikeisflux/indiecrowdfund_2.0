import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { notifyMarketplacePurchase, notifyMarketplaceSale } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketplace/purchase
 *
 * Initiate a purchase for a marketplace book
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { bookId, paymentMethod } = body;

    if (!bookId) {
      return NextResponse.json({ error: "bookId is required" }, { status: 400 });
    }

    // Get the book with creator info
    const book = await prisma.marketplaceBook.findFirst({
      where: {
        id: bookId,
        status: "LIVE",
        deletedAt: null,
      },
      include: {
        creator: {
          select: { id: true },
        },
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Check if already purchased
    const existingPurchase = await prisma.marketplacePurchase.findFirst({
      where: {
        bookId,
        buyerId: session.user.id,
        status: "COMPLETED",
      },
    });

    if (existingPurchase) {
      return NextResponse.json(
        { error: "You have already purchased this book" },
        { status: 400 }
      );
    }

    // Verify payment method matches book's requirements
    if (book.paymentProcessor === "DIVINITYCOIN" && paymentMethod !== "divinitycoin") {
      return NextResponse.json(
        { error: "This book requires DivinityCoin payment" },
        { status: 400 }
      );
    }

    // Create purchase record in PENDING state
    const purchase = await prisma.marketplacePurchase.create({
      data: {
        bookId,
        buyerId: session.user.id,
        amount: book.price,
        currency: book.currency,
        paymentProcessor: book.paymentProcessor,
        status: "PENDING",
      },
    });

    // If using DivinityCoin, handle the payment immediately
    if (paymentMethod === "divinitycoin") {
      // Check user's DivinityCoin balance
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { divinityCoinBalance: true },
      });

      const bookPrice = Number(book.price);
      const userBalance = user?.divinityCoinBalance || 0;

      if (userBalance < bookPrice) {
        // Delete the pending purchase
        await prisma.marketplacePurchase.delete({
          where: { id: purchase.id },
        });
        return NextResponse.json(
          { error: "Insufficient DivinityCoin balance" },
          { status: 400 }
        );
      }

      // Calculate platform fee (3%) and creator payout (97%)
      const platformFee = Math.round(bookPrice * 0.03 * 100) / 100; // Round to 2 decimal places
      const creatorPayout = Math.round((bookPrice - platformFee) * 100) / 100;

      // Deduct from buyer's balance
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          divinityCoinBalance: { decrement: bookPrice },
        },
      });

      // Credit creator's DivinityCoin balance (97%)
      await prisma.user.update({
        where: { id: book.creator.id },
        data: {
          divinityCoinBalance: { increment: creatorPayout },
        },
      });

      // Complete the purchase with fee details
      const completedPurchase = await prisma.marketplacePurchase.update({
        where: { id: purchase.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          deliveredAt: new Date(),
          divinityCoinPaymentId: `dc_${Date.now()}_${purchase.id}`,
          platformFee,
          creatorPayout,
        },
      });

      // Update book purchase count
      await prisma.marketplaceBook.update({
        where: { id: bookId },
        data: {
          purchaseCount: { increment: 1 },
        },
      });

      // Update company total sales if applicable
      if (book.companyId) {
        await prisma.companyProfile.update({
          where: { id: book.companyId },
          data: {
            totalSales: { increment: 1 },
          },
        });
      }

      // Send notifications (don't await to avoid blocking the response)
      notifyMarketplacePurchase(completedPurchase.id, "DIVINITYCOIN").catch((err) =>
        console.error(`[MarketplacePurchase] Failed to notify purchase ${completedPurchase.id}:`, err)
      );
      notifyMarketplaceSale(completedPurchase.id, "DIVINITYCOIN").catch((err) =>
        console.error(`[MarketplacePurchase] Failed to notify sale ${completedPurchase.id}:`, err)
      );

      return NextResponse.json({
        success: true,
        purchase: completedPurchase,
        message: "Purchase completed! Your book has been delivered to your Digital Library.",
        redirectUrl: "/dashboard/backer?tab=digital-library",
      });
    }

    // For Stripe payments, create a payment intent
    // This would integrate with Stripe's API
    // For now, return the purchase info for client-side Stripe handling
    return NextResponse.json({
      success: true,
      purchase,
      paymentRequired: true,
      paymentProcessor: book.paymentProcessor,
      amount: Number(book.price),
      currency: book.currency,
    });
  } catch (error) {
    console.error("Error processing purchase:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/marketplace/purchase
 *
 * Get user's purchases
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const purchases = await prisma.marketplacePurchase.findMany({
      where: {
        buyerId: session.user.id,
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverImageUrl: true,
            pdfCoverImageUrl: true,
            price: true,
            currency: true,
            creator: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    type PurchaseType = (typeof purchases)[number];
    return NextResponse.json({
      purchases: purchases.map((p: PurchaseType) => ({
        id: p.id,
        status: p.status,
        amount: Number(p.amount),
        currency: p.currency,
        purchasedAt: p.completedAt,
        book: {
          id: p.book.id,
          title: p.book.title,
          slug: p.book.slug,
          coverImage: p.book.coverImageUrl || p.book.pdfCoverImageUrl,
          creator: p.book.creator.name,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching purchases:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
