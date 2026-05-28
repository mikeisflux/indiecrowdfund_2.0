import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminMarketplaceBooksFeatureLogger = logger.child({ module: "admin-marketplace-books-feature" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/marketplace/books/[id]/feature
 *
 * Toggle featured status for a marketplace book
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { featured } = body;

    // Get the book
    const book = await prisma.marketplaceBook.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Update featured status
    await prisma.marketplaceBook.update({
      where: { id },
      data: {
        isFeatured: featured,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: featured ? "Book marked as featured" : "Book removed from featured",
    });
  } catch (error) {
    adminMarketplaceBooksFeatureLogger.error({ err: formatError(error) }, "Error updating featured status:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
