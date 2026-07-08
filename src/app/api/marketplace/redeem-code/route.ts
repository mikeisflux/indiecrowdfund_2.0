import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const marketplaceRedeemCodeLogger = logger.child({ module: "marketplace-redeem-code" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST: Redeem a free book promo code
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Please sign in to redeem a promo code" }, { status: 401 });
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

    // Validate the code
    if (!discountCode.isActive) {
      return NextResponse.json({ error: "This promo code is no longer active" }, { status: 400 });
    }

    const now = new Date();
    if (now < discountCode.validFrom || now > discountCode.validUntil) {
      return NextResponse.json({ error: "This promo code has expired" }, { status: 400 });
    }

    // maxRedemptions = 0 means unlimited
    if (discountCode.maxRedemptions > 0 && discountCode.usageCount >= discountCode.maxRedemptions) {
      return NextResponse.json({ error: "This promo code has reached its usage limit" }, { status: 400 });
    }

    if (discountCode.redemptions.length >= discountCode.maxPerCustomer) {
      return NextResponse.json({ error: "You have already used this promo code" }, { status: 400 });
    }

    // Only FREE_BOOK type is supported for this endpoint
    if (discountCode.type !== "FREE_BOOK") {
      return NextResponse.json({ error: "This promo code requires payment" }, { status: 400 });
    }

    // Get the book (excluding soft-deleted)
    const book = await db.marketplaceBook.findFirst({
      where: { id: bookId, deletedAt: null },
      select: {
        id: true,
        title: true,
        price: true,
        creatorId: true,
        companyId: true,
        status: true,
        pdfFileUrl: true,
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (book.status !== "LIVE") {
      return NextResponse.json({ error: "This book is not available" }, { status: 400 });
    }

    // Verify the code is valid for this book
    // If the code has a specific bookId, it must match
    // If the code has no bookId (legacy codes), check creator ownership
    if (discountCode.bookId) {
      if (discountCode.bookId !== bookId) {
        const codeBookTitle = discountCode.book?.title || "another book";
        return NextResponse.json({
          error: `This promo code is for "${codeBookTitle}", not this book`,
          validForBook: discountCode.book ? { id: discountCode.book.id, title: discountCode.book.title } : null,
        }, { status: 400 });
      }
    } else if (book.creatorId !== discountCode.creatorId) {
      return NextResponse.json({ error: "This promo code is not valid for this book" }, { status: 400 });
    }

    // Prevent self-redemption
    if (userId === discountCode.creatorId) {
      return NextResponse.json({ error: "You cannot use your own promo code" }, { status: 400 });
    }

    // Check if already purchased
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

    // Create the purchase and redemption in a transaction guarded by
    // an advisory lock keyed to userId+bookId. Without the lock, two
    // concurrent redeem clicks would both pass the existingPurchase
    // check, both pass the per-customer redemption check, and both
    // create COMPLETED MarketplacePurchase rows + double-increment
    // purchaseCount and company totalSales.
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`redeem-${userId}-${bookId}`}))`;

      // Re-check inside the lock — if another concurrent redeem
      // already created a COMPLETED purchase for this user+book,
      // bail out.
      const existingInsideLock = await tx.marketplacePurchase.findFirst({
        where: { buyerId: userId, bookId, status: "COMPLETED" },
        select: { id: true },
      });
      if (existingInsideLock) {
        throw new Error("ALREADY_REDEEMED");
      }

      // Create the $0 purchase
      const purchase = await tx.marketplacePurchase.create({
        data: {
          bookId: bookId,
          buyerId: userId,
          amount: 0,
          platformFee: 0,
          creatorPayout: 0,
          currency: "USD",
          paymentProcessor: "STRIPE", // Marking as STRIPE since no payment needed
          status: "COMPLETED",
          completedAt: new Date(),
          deliveredAt: new Date(),
        },
      });

      // Create the redemption record
      const redemption = await tx.marketplaceCodeRedemption.create({
        data: {
          codeId: discountCode.id,
          customerId: userId,
          bookId: bookId,
          purchaseId: purchase.id,
          discountAmount: book.price,
        },
      });

      // Increment the usage count atomically (race condition guard)
      if (discountCode.maxRedemptions > 0) {
        // Only increment if we haven't exceeded the limit yet (atomic check-and-update)
        const updated = await tx.marketplaceDiscountCode.updateMany({
          where: { id: discountCode.id, usageCount: { lt: discountCode.maxRedemptions } },
          data: { usageCount: { increment: 1 } },
        });
        if (updated.count === 0) {
          throw new Error("This promo code has reached its usage limit");
        }
      } else {
        await tx.marketplaceDiscountCode.update({
          where: { id: discountCode.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      // Increment the book's purchase count
      await tx.marketplaceBook.update({
        where: { id: bookId },
        data: {
          purchaseCount: { increment: 1 },
        },
      });

      // Update company total sales if applicable
      if (book.companyId) {
        await tx.companyProfile.update({
          where: { id: book.companyId },
          data: {
            totalSales: { increment: 1 },
          },
        });
      }

      return { purchase, redemption };
    });

    return NextResponse.json({
      success: true,
      message: "Book redeemed successfully!",
      purchaseId: result.purchase.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "This promo code has reached its usage limit") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "ALREADY_REDEEMED") {
      return NextResponse.json({ error: "You already own this book" }, { status: 409 });
    }
    marketplaceRedeemCodeLogger.error({ err: formatError(error) }, "Error redeeming promo code:");
    return NextResponse.json(
      { error: "Failed to redeem promo code" },
      { status: 500 }
    );
  }
}
