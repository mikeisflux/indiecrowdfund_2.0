import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyMarketplaceBookReview } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/marketplace/books/[id]/review
 *
 * Approve or reject a marketplace book
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
      select: { role: true, name: true },
    });

    if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

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

    if (book.status !== "PENDING_REVIEW") {
      return NextResponse.json(
        { error: "Book is not pending review" },
        { status: 400 }
      );
    }

    // Update book status
    const newStatus = action === "approve" ? "LIVE" : "REJECTED";

    await prisma.marketplaceBook.update({
      where: { id },
      data: {
        status: newStatus,
        rejectionReason: action === "reject" ? reason : null,
        reviewedAt: new Date(),
        reviewedById: session.user.id,
        publishedAt: action === "approve" ? new Date() : null,
      },
    });

    // Create review history entry
    await prisma.marketplaceBookReview.create({
      data: {
        bookId: id,
        reviewerId: session.user.id,
        action: action === "approve" ? "APPROVED" : "REJECTED",
        notes: reason || null,
      },
    });

    // Send notification to creator (don't await to avoid blocking response)
    notifyMarketplaceBookReview(
      id,
      action === "approve" ? "APPROVED" : "REJECTED",
      reason
    ).catch(console.error);

    return NextResponse.json({
      success: true,
      message: action === "approve" ? "Book approved and published" : "Book rejected",
    });
  } catch (error) {
    console.error("Error reviewing book:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
