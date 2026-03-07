import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminMarketplaceHistoryLogger = logger.child({ module: "admin-marketplace-history" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/marketplace/history
 *
 * Get marketplace book review history
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get review history
    const reviews = await prisma.marketplaceBookReview.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        book: {
          select: {
            id: true,
            title: true,
          },
        },
        reviewer: {
          select: {
            name: true,
          },
        },
      },
    });

    type ReviewType = (typeof reviews)[number];
    return NextResponse.json({
      reviews: reviews.map((review: ReviewType) => ({
        id: review.id,
        bookId: review.book.id,
        bookTitle: review.book.title,
        action: review.action,
        notes: review.notes,
        reviewedBy: review.reviewer.name || "Unknown",
        createdAt: review.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    adminMarketplaceHistoryLogger.error({ err: String(error) }, "Error fetching review history:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
