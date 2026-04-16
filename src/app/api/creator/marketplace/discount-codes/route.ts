import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorMarketplaceDiscountCodesLogger = logger.child({ module: "creator-marketplace-discount-codes" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

// Generate a unique, readable discount code
function generateDiscountCode(prefix: string = "FREE"): string {
  const randomPart = nanoid(6).toUpperCase();
  return `${prefix}-${randomPart}`;
}

// Get the start and end of the current month
function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// GET: Fetch creator's discount codes and available books
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { start: monthStart, end: monthEnd } = getCurrentMonthRange();

    // Get all discount codes for this creator
    const discountCodes = await db.marketplaceDiscountCode.findMany({
      where: {
        creatorId: userId,
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverImageUrl: true,
          },
        },
        redemptions: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            book: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Find the current month's code
    const currentMonthCode = discountCodes.find(
      (code: { validFrom: Date; validUntil: Date; type: string }) =>
        code.validFrom >= monthStart &&
        code.validUntil <= monthEnd &&
        code.type === "FREE_BOOK"
    );

    // Get creator's live books for the dropdown
    const liveBooks = await db.marketplaceBook.findMany({
      where: {
        creatorId: userId,
        status: "LIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        coverImageUrl: true,
        price: true,
      },
      orderBy: { title: "asc" },
    });

    // Convert Decimal prices to numbers for frontend
    type LiveBookType = typeof liveBooks[number];
    const formattedLiveBooks = liveBooks.map((book: LiveBookType) => ({
      ...book,
      price: Number(book.price),
    }));

    return NextResponse.json({
      discountCodes,
      currentMonthCode,
      liveBooks: formattedLiveBooks,
      hasLiveBooks: liveBooks.length > 0,
      monthRange: {
        start: monthStart.toISOString(),
        end: monthEnd.toISOString(),
      },
    });
  } catch (error) {
    creatorMarketplaceDiscountCodesLogger.error({ err: String(error) }, "Error fetching discount codes:");
    return NextResponse.json(
      { error: "Failed to fetch discount codes" },
      { status: 500 }
    );
  }
}

// POST: Create a new discount code for a specific book
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { start: monthStart, end: monthEnd } = getCurrentMonthRange();

    const body = await request.json();
    const { bookId } = body;

    if (!bookId) {
      return NextResponse.json(
        { error: "Please select a book for the promo code" },
        { status: 400 }
      );
    }

    // Verify the book exists and belongs to this creator
    const book = await db.marketplaceBook.findFirst({
      where: {
        id: bookId,
        creatorId: userId,
        status: "LIVE",
        deletedAt: null,
      },
    });

    if (!book) {
      return NextResponse.json(
        { error: "Book not found or not available" },
        { status: 400 }
      );
    }

    // Get creator's name for code prefix
    const creator = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { name: true, vanityUrl: true },
    });

    // Generate a unique code
    const prefix = (creator?.vanityUrl || creator?.name || "FREE")
      .substring(0, 6)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    let code = generateDiscountCode(prefix);

    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.marketplaceDiscountCode.findUnique({
        where: { code },
      });
      if (!existing) break;
      code = generateDiscountCode(prefix);
      attempts++;
    }

    // Check-then-create wrapped in a $transaction guarded by an advisory
    // lock keyed to creatorId+bookId+month. Without this, two concurrent
    // POSTs for the same book in the same month would both pass the
    // existsCheck and both create discount codes — violating the
    // "one promo code per book per month" rule.
    let discountCode;
    try {
      discountCode = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`discount-${userId}-${bookId}-${monthStart.toISOString()}`}))`;

        const existingCode = await tx.marketplaceDiscountCode.findFirst({
          where: {
            creatorId: userId,
            bookId: bookId,
            type: "FREE_BOOK",
            validFrom: { gte: monthStart },
            validUntil: { lte: monthEnd },
          },
        });

        if (existingCode) {
          throw new Error("DISCOUNT_CODE_EXISTS");
        }

        return tx.marketplaceDiscountCode.create({
          data: {
            creatorId: userId,
            bookId: bookId,
            code,
            type: "FREE_BOOK",
            validFrom: monthStart,
            validUntil: monthEnd,
            maxRedemptions: 0, // Unlimited
            maxPerCustomer: 1,
            isActive: true,
          },
          include: {
            book: {
              select: {
                id: true,
                title: true,
                slug: true,
                coverImageUrl: true,
              },
            },
          },
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === "DISCOUNT_CODE_EXISTS") {
        return NextResponse.json(
          { error: "You already have a promo code for this book this month" },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json({
      success: true,
      discountCode,
    });
  } catch (error) {
    creatorMarketplaceDiscountCodesLogger.error({ err: String(error) }, "Error creating discount code:");
    return NextResponse.json(
      { error: "Failed to create discount code" },
      { status: 500 }
    );
  }
}

// PUT: Update an existing discount code (change book)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { codeId, bookId, isActive } = body;

    if (!codeId) {
      return NextResponse.json(
        { error: "Code ID is required" },
        { status: 400 }
      );
    }

    // Verify the code exists and belongs to this creator
    const existingCode = await db.marketplaceDiscountCode.findFirst({
      where: {
        id: codeId,
        creatorId: userId,
      },
    });

    if (!existingCode) {
      return NextResponse.json(
        { error: "Discount code not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: { bookId?: string; isActive?: boolean } = {};

    // If updating bookId, verify the new book exists
    if (bookId !== undefined) {
      if (bookId) {
        const book = await db.marketplaceBook.findFirst({
          where: {
            id: bookId,
            creatorId: userId,
            status: "LIVE",
            deletedAt: null,
          },
        });

        if (!book) {
          return NextResponse.json(
            { error: "Book not found or not available" },
            { status: 400 }
          );
        }
      }
      updateData.bookId = bookId || undefined;
    }

    // Update isActive if provided
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const updatedCode = await db.marketplaceDiscountCode.update({
      where: { id: codeId },
      data: updateData,
      include: {
        book: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverImageUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      discountCode: updatedCode,
    });
  } catch (error) {
    creatorMarketplaceDiscountCodesLogger.error({ err: String(error) }, "Error updating discount code:");
    return NextResponse.json(
      { error: "Failed to update discount code" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a discount code
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get("codeId");

    if (!codeId) {
      return NextResponse.json(
        { error: "Code ID is required" },
        { status: 400 }
      );
    }

    // Verify the code exists and belongs to this creator
    const existingCode = await db.marketplaceDiscountCode.findFirst({
      where: {
        id: codeId,
        creatorId: userId,
      },
      include: {
        redemptions: true,
      },
    });

    if (!existingCode) {
      return NextResponse.json(
        { error: "Discount code not found" },
        { status: 404 }
      );
    }

    // If code has redemptions, just deactivate instead of deleting
    if (existingCode.redemptions.length > 0) {
      await db.marketplaceDiscountCode.update({
        where: { id: codeId },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: "Discount code deactivated (has existing redemptions)",
        deactivated: true,
      });
    }

    // Delete the code if no redemptions. Use deleteMany scoped to creatorId
    // so cross-creator abuse is blocked AND a concurrent double-click
    // (second delete on an already-gone row) returns { count: 0 } instead
    // of throwing P2025.
    const deleted = await db.marketplaceDiscountCode.deleteMany({
      where: { id: codeId, creatorId: userId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({
        success: true,
        message: "Discount code already deleted",
        deleted: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Discount code deleted",
      deleted: true,
    });
  } catch (error) {
    creatorMarketplaceDiscountCodesLogger.error({ err: String(error) }, "Error deleting discount code:");
    return NextResponse.json(
      { error: "Failed to delete discount code" },
      { status: 500 }
    );
  }
}
