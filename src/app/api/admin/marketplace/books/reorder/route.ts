import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminMarketplaceBooksReorderLogger = logger.child({ module: "admin-marketplace-books-reorder" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/marketplace/books/reorder
 *
 * Reorder books in Featured or Staff Picks section
 */
export async function POST(request: Request) {
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

    const body = await request.json();
    const { category, bookIds } = body;

    if (!category || !["featured", "staffPick"].includes(category)) {
      return NextResponse.json(
        { error: "Invalid category. Must be 'featured' or 'staffPick'" },
        { status: 400 }
      );
    }

    if (!Array.isArray(bookIds) || bookIds.length === 0) {
      return NextResponse.json(
        { error: "bookIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Update order for each book
    const orderField = category === "featured" ? "featuredOrder" : "staffPickOrder";

    // Use a transaction to update all books
    await prisma.$transaction(
      bookIds.map((bookId: string, index: number) =>
        prisma.marketplaceBook.update({
          where: { id: bookId },
          data: { [orderField]: index + 1 },
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: `Updated ${category} order for ${bookIds.length} books`,
    });
  } catch (error) {
    adminMarketplaceBooksReorderLogger.error({ err: String(error) }, "Error reordering books:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
