import { NextRequest, NextResponse } from "next/server";
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

// GET: Fetch creator's discount codes
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

    // Check if creator has any live books (required to have a promo code)
    const liveBooks = await db.marketplaceBook.count({
      where: {
        creatorId: userId,
        status: "LIVE",
        deletedAt: null,
      },
    });

    return NextResponse.json({
      discountCodes,
      currentMonthCode,
      hasLiveBooks: liveBooks > 0,
      monthRange: {
        start: monthStart.toISOString(),
        end: monthEnd.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching discount codes:", error);
    return NextResponse.json(
      { error: "Failed to fetch discount codes" },
      { status: 500 }
    );
  }
}

// POST: Generate a new monthly free book code
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { start: monthStart, end: monthEnd } = getCurrentMonthRange();

    // Check if creator has any live books
    const liveBooks = await db.marketplaceBook.count({
      where: {
        creatorId: userId,
        status: "LIVE",
        deletedAt: null,
      },
    });

    if (liveBooks === 0) {
      return NextResponse.json(
        { error: "You need at least one live book to create a promo code" },
        { status: 400 }
      );
    }

    // Check if a code already exists for this month
    const existingCode = await db.marketplaceDiscountCode.findFirst({
      where: {
        creatorId: userId,
        type: "FREE_BOOK",
        validFrom: { gte: monthStart },
        validUntil: { lte: monthEnd },
      },
    });

    if (existingCode) {
      return NextResponse.json(
        { error: "You already have a promo code for this month", code: existingCode },
        { status: 400 }
      );
    }

    // Get creator's name for code prefix
    const creator = await db.user.findUnique({
      where: { id: userId },
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

    // Parse optional body for custom settings
    // maxRedemptions = 0 means unlimited
    let maxRedemptions = 0;
    try {
      const body = await request.json();
      if (body.maxRedemptions && typeof body.maxRedemptions === "number") {
        maxRedemptions = Math.max(0, body.maxRedemptions); // 0 = unlimited, any positive number = that limit
      }
    } catch {
      // No body or invalid JSON, use defaults (unlimited)
    }

    // Create the discount code
    const discountCode = await db.marketplaceDiscountCode.create({
      data: {
        creatorId: userId,
        code,
        type: "FREE_BOOK",
        validFrom: monthStart,
        validUntil: monthEnd,
        maxRedemptions,
        maxPerCustomer: 1,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      discountCode,
    });
  } catch (error) {
    console.error("Error creating discount code:", error);
    return NextResponse.json(
      { error: "Failed to create discount code" },
      { status: 500 }
    );
  }
}
