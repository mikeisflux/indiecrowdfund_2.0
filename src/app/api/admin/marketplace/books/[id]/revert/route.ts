import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminMarketplaceBooksRevertLogger = logger.child({ module: "admin-marketplace-books-revert" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { notifyMarketplaceBookReverted } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/marketplace/books/[id]/revert
 *
 * Revert a live marketplace book back to PENDING_REVIEW and notify the
 * creator with the reason so they can correct the issue.
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

    const user = await prisma.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    if (!reason) {
      return NextResponse.json(
        { error: "A revert reason is required" },
        { status: 400 }
      );
    }
    if (reason.length > 200) {
      return NextResponse.json({ error: "Reason is too long" }, { status: 400 });
    }
    if (notes.length > 2000) {
      return NextResponse.json({ error: "Notes are too long" }, { status: 400 });
    }

    const book = await prisma.marketplaceBook.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (book.status !== "LIVE" && book.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only a live book can be reverted to pending review" },
        { status: 400 }
      );
    }

    // The stored reason combines the dropdown choice with any extra notes.
    const fullReason = notes ? `${reason} — ${notes}` : reason;
    const previousStatus = book.status;

    // CAS on status so two admins acting at once can't both flip the book
    // and both fire the review-record + creator-notification side effects.
    const revertCas = await prisma.marketplaceBook.updateMany({
      where: { id, status: previousStatus, deletedAt: null },
      data: {
        status: "PENDING_REVIEW",
        rejectionReason: fullReason,
        approvedAt: null,
        publishedAt: null,
      },
    });

    if (revertCas.count === 0) {
      return NextResponse.json(
        { error: "Book status changed — another admin may have already updated it." },
        { status: 409 }
      );
    }

    // Record the action in the book's review history.
    await prisma.marketplaceBookReview.create({
      data: {
        bookId: id,
        reviewerId: session.user.id,
        action: "REQUESTED_CHANGES",
        previousStatus,
        newStatus: "PENDING_REVIEW",
        notes: fullReason,
        rejectionReason: fullReason,
      },
    });

    // Notify the creator (fire-and-forget so the response isn't blocked).
    notifyMarketplaceBookReverted(id, fullReason).catch(console.error);

    return NextResponse.json({
      success: true,
      message: "Book reverted to pending review",
    });
  } catch (error) {
    adminMarketplaceBooksRevertLogger.error({ err: String(error) }, "Error reverting book:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
