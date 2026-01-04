import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST: Validate a discount code for a specific book
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Please sign in to use a promo code" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { code, bookId } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Promo code is required" }, { status: 400 });
    }

    if (!bookId || typeof bookId !== "string") {
      return NextResponse.json({ error: "Book ID is required" }, { status: 400 });
    }

    // Find the discount code
    const discountCode = await db.marketplaceDiscountCode.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
        book: {
          select: {
            id: true,
            title: true,
          },
        },
        redemptions: {
          where: { customerId: userId },
        },
      },
    });

    if (!discountCode) {
      return NextResponse.json({ error: "Invalid promo code" }, { status: 400 });
    }

    // Check if code is active
    if (!discountCode.isActive) {
      return NextResponse.json({ error: "This promo code is no longer active" }, { status: 400 });
    }

    // Check validity period
    const now = new Date();
    if (now < discountCode.validFrom) {
      return NextResponse.json({ error: "This promo code is not yet valid" }, { status: 400 });
    }
    if (now > discountCode.validUntil) {
      return NextResponse.json({ error: "This promo code has expired" }, { status: 400 });
    }

    // Check max redemptions (maxRedemptions = 0 means unlimited)
    if (discountCode.maxRedemptions > 0 && discountCode.usageCount >= discountCode.maxRedemptions) {
      return NextResponse.json({ error: "This promo code has reached its usage limit" }, { status: 400 });
    }

    // Check per-customer limit
    if (discountCode.redemptions.length >= discountCode.maxPerCustomer) {
      return NextResponse.json({ error: "You have already used this promo code" }, { status: 400 });
    }

    // Check if customer already redeemed for this specific book
    const existingRedemption = discountCode.redemptions.find((r: { bookId: string }) => r.bookId === bookId);
    if (existingRedemption) {
      return NextResponse.json({ error: "You have already used a promo code for this book" }, { status: 400 });
    }

    // Get the book to verify it belongs to the code creator
    const book = await db.marketplaceBook.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        title: true,
        price: true,
        creatorId: true,
        status: true,
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (book.status !== "LIVE") {
      return NextResponse.json({ error: "This book is not available for purchase" }, { status: 400 });
    }

    // Verify the code is valid for this book
    // If the code has a specific bookId, it must match
    // If the code has no bookId (legacy codes), check creator ownership
    if (discountCode.bookId) {
      if (discountCode.bookId !== bookId) {
        return NextResponse.json({ error: "This promo code is not valid for this book" }, { status: 400 });
      }
    } else if (book.creatorId !== discountCode.creatorId) {
      return NextResponse.json({ error: "This promo code is not valid for this book" }, { status: 400 });
    }

    // Check if customer is trying to use their own code
    if (userId === discountCode.creatorId) {
      return NextResponse.json({ error: "You cannot use your own promo code" }, { status: 400 });
    }

    // Check if customer already owns this book
    const existingPurchase = await db.marketplacePurchase.findFirst({
      where: {
        buyerId: userId,
        bookId: bookId,
        status: "COMPLETED",
      },
    });

    if (existingPurchase) {
      return NextResponse.json({ error: "You already own this book" }, { status: 400 });
    }

    // Calculate discount
    let discountAmount = 0;
    let finalPrice = Number(book.price);

    if (discountCode.type === "FREE_BOOK") {
      discountAmount = Number(book.price);
      finalPrice = 0;
    }

    return NextResponse.json({
      valid: true,
      code: discountCode.code,
      type: discountCode.type,
      discountAmount,
      originalPrice: Number(book.price),
      finalPrice,
      creatorName: discountCode.creator.name,
      bookTitle: book.title,
      expiresAt: discountCode.validUntil.toISOString(),
    });
  } catch (error) {
    console.error("Error validating discount code:", error);
    return NextResponse.json(
      { error: "Failed to validate promo code" },
      { status: 500 }
    );
  }
}
