import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorMarketplaceBooksSubmitLogger = logger.child({ module: "creator-marketplace-books-submit" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { validateStripeConnectAccount } from "@/lib/payments/stripe";

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

    // Check ownership
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

    // Validate Stripe Connect account if payment processor is Stripe
    if (book.paymentProcessor === "STRIPE") {
      const stripeValidation = await validateStripeConnectAccount(session.user.id);
      if (!stripeValidation.isValid) {
        return NextResponse.json(
          {
            error: "Stripe account not ready",
            message: stripeValidation.error,
            code: "STRIPE_NOT_READY",
          },
          { status: 400 }
        );
      }
    }

    // Update status to pending review
    const updatedBook = await prisma.marketplaceBook.update({
      where: { id },
      data: {
        status: "PENDING_REVIEW",
        submittedAt: new Date(),
        rejectionReason: null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      book: {
        id: updatedBook.id,
        title: updatedBook.title,
        status: updatedBook.status,
      },
      message: "Book submitted for review",
    });
  } catch (error) {
    creatorMarketplaceBooksSubmitLogger.error({ err: String(error) }, "Error submitting book for review:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
