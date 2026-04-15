import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminMarketplaceBooksReviewLogger = logger.child({ module: "admin-marketplace-books-review" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { notifyMarketplaceBookReview } from "@/lib/notifications";
import { notifyBookPublished } from "@/lib/seo/indexing";

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
    const user = await prisma.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
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

    // Get the book with creator info
    const book = await prisma.marketplaceBook.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        creator: {
          select: { id: true, role: true },
        },
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

    // CAS on status: PENDING_REVIEW → {LIVE,REJECTED}. Without this,
    // two admins reviewing concurrently would both pass the check,
    // both flip the status, both create MarketplaceBookReview rows,
    // and both fire the search-engine indexing + creator notification
    // + creator role promotion side effects.
    const newStatus = action === "approve" ? "LIVE" : "REJECTED";

    const reviewCas = await prisma.marketplaceBook.updateMany({
      where: { id, status: "PENDING_REVIEW", deletedAt: null },
      data: {
        status: newStatus,
        rejectionReason: action === "reject" ? reason : null,
        approvedAt: action === "approve" ? new Date() : null,
        rejectedAt: action === "reject" ? new Date() : null,
        publishedAt: action === "approve" ? new Date() : null,
      },
    });

    if (reviewCas.count === 0) {
      return NextResponse.json(
        { error: "Book status changed — another admin may have already reviewed it." },
        { status: 409 }
      );
    }

    // Create review history entry
    await prisma.marketplaceBookReview.create({
      data: {
        bookId: id,
        reviewerId: session.user.id,
        action: action === "approve" ? "APPROVED" : "REJECTED",
        previousStatus: "PENDING_REVIEW",
        newStatus: newStatus,
        notes: reason || null,
      },
    });

    // Auto-promote user to CREATOR role when marketplace book is approved
    if (action === "approve" && book.creator?.role === "USER") {
      await prisma.user.update({
        where: { id: book.creator.id },
        data: { role: "CREATOR" },
      });
    }

    // Notify search engines when a book is approved (fire-and-forget)
    if (action === "approve") {
      notifyBookPublished(book.slug);
    }

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
    adminMarketplaceBooksReviewLogger.error({ err: String(error) }, "Error reviewing book:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
