import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/creator/marketplace/books/[id]
 *
 * Get a specific book
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

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

    return NextResponse.json({
      book: {
        id: book.id,
        title: book.title,
        slug: book.slug,
        description: book.description,
        category: book.category,
        price: Number(book.price),
        currency: book.currency,
        paymentProcessor: book.paymentProcessor,
        coverImage: book.coverImageUrl || book.pdfCoverImageUrl,
        promoVideoUrl: book.promoVideoUrl,
        pdfFileUrl: book.pdfFileUrl,
        isNsfw: book.isNsfw,
        tags: book.tags,
        status: book.status,
        isFeatured: book.isFeatured,
        isStaffPick: book.isStaffPick,
        rejectionReason: book.rejectionReason,
        createdAt: book.createdAt.toISOString(),
        publishedAt: book.publishedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Error fetching book:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/creator/marketplace/books/[id]
 *
 * Update a book
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check ownership
    const existingBook = await prisma.marketplaceBook.findFirst({
      where: {
        id,
        creatorId: session.user.id,
        deletedAt: null,
      },
    });

    if (!existingBook) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Can't edit if pending review or live (unless just archiving)
    if (
      existingBook.status === "PENDING_REVIEW" &&
      !body.status
    ) {
      return NextResponse.json(
        { error: "Cannot edit book while pending review" },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      category,
      price,
      currency,
      paymentProcessor,
      promoImageUrl,
      promoVideoUrl,
      pdfFileUrl,
      isNsfw,
      tags,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (category !== undefined) updateData.category = category;
    if (price !== undefined) updateData.price = price;
    if (currency !== undefined) updateData.currency = currency;
    if (paymentProcessor !== undefined)
      updateData.paymentProcessor = isNsfw ? "DIVINITYCOIN" : paymentProcessor;
    if (promoImageUrl !== undefined) updateData.coverImageUrl = promoImageUrl;
    if (promoVideoUrl !== undefined) updateData.promoVideoUrl = promoVideoUrl;
    if (pdfFileUrl !== undefined) updateData.pdfFileUrl = pdfFileUrl;
    if (isNsfw !== undefined) updateData.isNsfw = isNsfw;
    if (tags !== undefined) updateData.tags = tags;

    // If rejected, reset to draft when editing
    if (existingBook.status === "REJECTED") {
      updateData.status = "DRAFT";
      updateData.rejectionReason = null;
    }

    updateData.updatedAt = new Date();

    const book = await prisma.marketplaceBook.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      book: {
        id: book.id,
        title: book.title,
        slug: book.slug,
        status: book.status,
      },
    });
  } catch (error) {
    console.error("Error updating book:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/creator/marketplace/books/[id]
 *
 * Delete (soft) a book
 */
export async function DELETE(
  request: Request,
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

    // Soft delete
    await prisma.marketplaceBook.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: "ARCHIVED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Book deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting book:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
