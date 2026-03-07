import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminMarketplaceBooksStaffPickLogger = logger.child({ module: "admin-marketplace-books-staff-pick" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/marketplace/books/[id]/staff-pick
 *
 * Toggle staff pick status for a marketplace book
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
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { staffPick } = body;

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

    // Update staff pick status
    await prisma.marketplaceBook.update({
      where: { id },
      data: {
        isStaffPick: staffPick,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: staffPick ? "Book marked as staff pick" : "Book removed from staff picks",
    });
  } catch (error) {
    adminMarketplaceBooksStaffPickLogger.error({ err: String(error) }, "Error updating staff pick status:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
