import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

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
