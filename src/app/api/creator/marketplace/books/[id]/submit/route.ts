import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorMarketplaceBooksSubmitLogger = logger.child({ module: "creator-marketplace-books-submit" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/creator/marketplace/books/[id]/submit
 *
 * Submit a book for review
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check ownership and fetch for validation
    const book = await prisma.marketplaceBook.findFirst({
      where: {
        id,
        creatorId: session.user.id,
        deletedAt: null,
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Can only submit drafts or rejected books
    if (book.status !== "DRAFT" && book.status !== "REJECTED") {
      return NextResponse.json(
        { error: `Cannot submit book with status ${book.status}` },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!book.title?.trim()) {
      return NextResponse.json(
        { error: "Book title is required" },
        { status: 400 }
      );
    }

    if (!book.description?.trim()) {
      return NextResponse.json(
        { error: "Book description is required" },
        { status: 400 }
      );
    }

    if (!book.pdfFileUrl) {
      return NextResponse.json(
        { error: "PDF file is required" },
        { status: 400 }
      );
    }

    if (!book.price || Number(book.price) <= 0) {
      return NextResponse.json(
        { error: "Valid price is required" },
        { status: 400 }
      );
    }

    // Use updateMany with status guard to prevent TOCTOU — if another
    // request already moved the book out of DRAFT/REJECTED, count === 0.
    const { count } = await prisma.marketplaceBook.updateMany({
      where: {
        id,
        creatorId: session.user.id,
        deletedAt: null,
        status: { in: ["DRAFT", "REJECTED"] },
      },
      data: {
        status: "PENDING_REVIEW",
        submittedAt: new Date(),
        rejectionReason: null,
        updatedAt: new Date(),
      },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: "Book status has already changed, cannot submit" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      book: {
        id: book.id,
        title: book.title,
        status: "PENDING_REVIEW",
      },
      message: "Book submitted for review",
    });
  } catch (error) {
    creatorMarketplaceBooksSubmitLogger.error({ err: formatError(error) }, "Error submitting book for review:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
