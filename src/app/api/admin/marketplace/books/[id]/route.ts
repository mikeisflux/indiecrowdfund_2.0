import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

import { logger } from "@/lib/logger";

const adminMarketplaceBooksLogger = logger.child({ module: "admin-marketplace-books" });


export const dynamic = "force-dynamic";

/**
 * GET /api/admin/marketplace/books/[id]
 *
 * Get full book details including PDF info (admin only)
 */
export async function GET(
  _request: Request,
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

    const book = await prisma.marketplaceBook.findFirst({
      where: { id, deletedAt: null },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    return NextResponse.json({ book });
  } catch (error) {
    adminMarketplaceBooksLogger.error({ err: error }, "Error fetching book:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/marketplace/books/[id]
 *
 * Update book details including PDF info (admin only)
 * This bypasses the DRAFT-only restriction for regular users
 */
export async function PATCH(
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

    const book = await prisma.marketplaceBook.findFirst({
      where: { id, deletedAt: null },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const body = await request.json();

    // Build update data - only include fields that are provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    // PDF fields
    if (body.pdfFileUrl !== undefined) updateData.pdfFileUrl = body.pdfFileUrl;
    if (body.pdfFileName !== undefined) updateData.pdfFileName = body.pdfFileName;
    if (body.pdfFileSize !== undefined) updateData.pdfFileSize = body.pdfFileSize;
    if (body.pdfCoverImageUrl !== undefined) updateData.pdfCoverImageUrl = body.pdfCoverImageUrl;
    if (body.pdfTotalPages !== undefined) updateData.pdfTotalPages = body.pdfTotalPages;

    // Other editable fields
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.shortDescription !== undefined) updateData.shortDescription = body.shortDescription;
    if (body.coverImageUrl !== undefined) updateData.coverImageUrl = body.coverImageUrl;
    if (body.promoVideoUrl !== undefined) updateData.promoVideoUrl = body.promoVideoUrl;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.isFeatured !== undefined) updateData.isFeatured = body.isFeatured;
    if (body.isStaffPick !== undefined) updateData.isStaffPick = body.isStaffPick;
    if (body.status !== undefined) {
      // status is a MarketplaceBookStatus enum column — writing an
      // unknown value here triggers a Prisma validation error that
      // the generic 500 catch below would mask (same class of bug
      // as the prelaunch reject 500 fixed in fe4d6d3f).
      const validStatuses = ["DRAFT", "SUBMITTED", "PENDING_REVIEW", "APPROVED", "REJECTED", "LIVE", "DEACTIVATED", "ARCHIVED"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status "${body.status}". Must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    adminMarketplaceBooksLogger.info({ bookId: id, updateData }, "Updating book");

    const updatedBook = await prisma.marketplaceBook.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      book: updatedBook,
    });
  } catch (error) {
    adminMarketplaceBooksLogger.error({ err: error }, "Error updating book:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
