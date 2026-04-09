import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorMarketplaceBooksLogger = logger.child({ module: "creator-marketplace-books" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

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
        mediaCategory: book.mediaCategory,
        category: book.category,
        price: Number(book.price),
        currency: book.currency,
        paymentProcessor: book.paymentProcessor,
        coverImage: book.coverImageUrl || book.pdfCoverImageUrl,
        promoVideoUrl: book.promoVideoUrl,
        pdfFileUrl: book.pdfFileUrl,
        pdfFileSize: book.pdfFileSize,
        audioFileUrl: book.audioFileUrl,
        audioFileName: book.audioFileName,
        audioFileSize: book.audioFileSize,
        audioDuration: book.audioDuration,
        videoFileUrl: book.videoFileUrl,
        videoFileName: book.videoFileName,
        videoFileSize: book.videoFileSize ? Number(book.videoFileSize) : null,
        videoDuration: book.videoDuration,
        videoResolution: book.videoResolution,
        isNsfw: book.hasAdultContent,
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
    creatorMarketplaceBooksLogger.error({ err: String(error) }, "Error fetching book:");
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
      mediaCategory,
      category,
      price,
      currency,
      paymentProcessor,
      promoImageUrl,
      promoVideoUrl,
      pdfFileUrl,
      pdfFileName,
      pdfFileSize,
      audioFileUrl,
      audioFileName,
      audioFileSize,
      audioDuration,
      videoFileUrl,
      videoFileName,
      videoFileSize,
      videoDuration,
      videoResolution,
      isNsfw,
      tags,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (mediaCategory !== undefined) updateData.mediaCategory = mediaCategory;
    if (category !== undefined) updateData.category = category;
    if (price !== undefined) updateData.price = price;
    if (currency !== undefined) updateData.currency = currency;
    if (paymentProcessor !== undefined)
      updateData.paymentProcessor = isNsfw ? "DIVINITYCOIN" : paymentProcessor;
    if (promoImageUrl !== undefined) updateData.coverImageUrl = promoImageUrl;
    if (promoVideoUrl !== undefined) updateData.promoVideoUrl = promoVideoUrl;
    if (pdfFileUrl !== undefined) updateData.pdfFileUrl = pdfFileUrl;
    if (pdfFileName !== undefined) updateData.pdfFileName = pdfFileName;
    if (pdfFileSize !== undefined) updateData.pdfFileSize = pdfFileSize ? parseInt(String(pdfFileSize)) : null;
    if (audioFileUrl !== undefined) updateData.audioFileUrl = audioFileUrl;
    if (audioFileName !== undefined) updateData.audioFileName = audioFileName;
    if (audioFileSize !== undefined) updateData.audioFileSize = audioFileSize ? parseInt(String(audioFileSize)) : null;
    if (audioDuration !== undefined) updateData.audioDuration = audioDuration ? parseInt(String(audioDuration)) : null;
    if (videoFileUrl !== undefined) updateData.videoFileUrl = videoFileUrl;
    if (videoFileName !== undefined) updateData.videoFileName = videoFileName;
    if (videoFileSize !== undefined) updateData.videoFileSize = videoFileSize ? BigInt(videoFileSize) : null;
    if (videoDuration !== undefined) updateData.videoDuration = videoDuration ? parseInt(String(videoDuration)) : null;
    if (videoResolution !== undefined) updateData.videoResolution = videoResolution;
    if (isNsfw !== undefined) {
      updateData.hasAdultContent = isNsfw;
      updateData.promoContentSfw = !isNsfw;
    }
    if (tags !== undefined) updateData.tags = tags;

    // If rejected, reset to draft when editing
    if (existingBook.status === "REJECTED") {
      updateData.status = "DRAFT";
      updateData.rejectionReason = null;
    }

    // If the book is LIVE and a file or cover was changed, require re-review
    const pdfChanged = pdfFileUrl !== undefined && pdfFileUrl !== existingBook.pdfFileUrl;
    const audioChanged = audioFileUrl !== undefined && audioFileUrl !== existingBook.audioFileUrl;
    const videoChanged = videoFileUrl !== undefined && videoFileUrl !== existingBook.videoFileUrl;
    const coverImageChanged = promoImageUrl !== undefined && promoImageUrl !== existingBook.coverImageUrl;
    const requiresReReview = existingBook.status === "LIVE" && (pdfChanged || audioChanged || videoChanged || coverImageChanged);

    // Debug logging
    creatorMarketplaceBooksLogger.info({ data: {
      bookStatus: existingBook.status,
      promoImageUrl,
      existingCoverImageUrl: existingBook.coverImageUrl,
      pdfFileUrl,
      existingPdfFileUrl: existingBook.pdfFileUrl,
      pdfChanged,
      coverImageChanged,
      requiresReReview,
    } }, "[Book Update Debug]");

    if (requiresReReview) {
      updateData.status = "PENDING_REVIEW";
      updateData.submittedAt = new Date();
      updateData.approvedAt = null;
      updateData.publishedAt = null;
    }

    updateData.updatedAt = new Date();

    const book = await prisma.marketplaceBook.update({
      where: { id },
      data: updateData,
    });

    // Create review history entry if sent for re-review
    if (requiresReReview) {
      const changedItems = [];
      if (pdfChanged) changedItems.push("PDF file");
      if (coverImageChanged) changedItems.push("cover image");

      await prisma.marketplaceBookReview.create({
        data: {
          bookId: id,
          reviewerId: session.user.id,
          action: "SUBMITTED",
          previousStatus: "LIVE",
          newStatus: "PENDING_REVIEW",
          notes: `${changedItems.join(" and ")} updated - sent for re-review`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      book: {
        id: book.id,
        title: book.title,
        slug: book.slug,
        status: book.status,
      },
      requiresReReview,
    });
  } catch (error) {
    creatorMarketplaceBooksLogger.error({ err: String(error) }, "Error updating book:");
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
    creatorMarketplaceBooksLogger.error({ err: String(error) }, "Error deleting book:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
