import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorMarketplaceBooksLogger = logger.child({ module: "creator-marketplace-books" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/creator/marketplace/books
 *
 * Create a new marketplace book
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      mediaCategory = "comics",
      category,
      price,
      currency = "USD",
      paymentProcessor = "STRIPE",
      promoImageUrl,
      promoVideoUrl,
      pdfFileUrl,
      pdfFileName,
      pdfFileSize,
      isNsfw = false,
      tags = [],
      submitForReview = false,
    } = body;

    // Validation
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!description?.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (!pdfFileUrl) {
      return NextResponse.json(
        { error: "PDF file is required" },
        { status: 400 }
      );
    }

    if (!price || price <= 0) {
      return NextResponse.json(
        { error: "Valid price is required" },
        { status: 400 }
      );
    }

    // Generate unique slug (must be unique per creator)
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 100); // Limit slug length
    let slug = baseSlug || "untitled";
    let counter = 1;

    // Check for both active and soft-deleted books since unique constraint is on [creatorId, slug]
    while (
      await prisma.marketplaceBook.findFirst({
        where: {
          creatorId: session.user.id,
          slug,
        },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Get creator's company if they have one
    const company = await prisma.companyProfile.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: { id: true },
    });

    // Create the book with a P2002 retry loop on slug collision.
    // The `while findFirst` check above is TOCTOU — two concurrent
    // creates with the same base title would both pick the same
    // numbered slug and one would P2002 on the @@unique([creatorId, slug])
    // constraint. Retry with a bumped counter on collision.
    let book;
    let retryAttempts = 0;
    while (true) {
      try {
        book = await prisma.marketplaceBook.create({
          data: {
            creatorId: session.user.id,
            companyId: company?.id,
            title: title.trim(),
            slug,
            description: description.trim(),
            mediaCategory: mediaCategory || "comics",
            category: category || null,
            price,
            currency,
            paymentProcessor: isNsfw ? "DIVINITYCOIN" : paymentProcessor,
            coverImageUrl: promoImageUrl || null,
            promoVideoUrl: promoVideoUrl || null,
            pdfFileUrl,
            pdfFileName: pdfFileName || null,
            pdfFileSize: pdfFileSize ? parseInt(String(pdfFileSize)) : null,
            hasAdultContent: isNsfw,
            promoContentSfw: !isNsfw,
            tags,
            status: submitForReview ? "PENDING_REVIEW" : "DRAFT",
            submittedAt: submitForReview ? new Date() : null,
          },
        });
        break;
      } catch (createErr) {
        const isUniqueViolation =
          createErr &&
          typeof createErr === "object" &&
          "code" in createErr &&
          (createErr as { code?: string }).code === "P2002";
        if (!isUniqueViolation || retryAttempts >= 5) throw createErr;
        retryAttempts++;
        counter++;
        slug = `${baseSlug}-${counter}`;
      }
    }

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
    creatorMarketplaceBooksLogger.error({ err: String(error) }, "Error creating marketplace book:");
    // Log more details for debugging
    if (error instanceof Error) {
      creatorMarketplaceBooksLogger.error({ err: String(error.message) }, "Error message:");
      creatorMarketplaceBooksLogger.error({ err: String(error.stack) }, "Error stack:");
      // Return more detail in development
      return NextResponse.json(
        {
          error: "Internal server error",
          details: process.env.NODE_ENV === "development" ? error.message : undefined,
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/creator/marketplace/books
 *
 * Get creator's marketplace books
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const books = await prisma.marketplaceBook.findMany({
      where: {
        creatorId: session.user.id,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        coverImageUrl: true,
        pdfCoverImageUrl: true,
        price: true,
        currency: true,
        status: true,
        isFeatured: true,
        isStaffPick: true,
        purchaseCount: true,
        viewCount: true,
        createdAt: true,
        publishedAt: true,
        rejectionReason: true,
      },
    });

    type BookType = (typeof books)[number];
    return NextResponse.json({
      books: books.map((book: BookType) => ({
        id: book.id,
        title: book.title,
        slug: book.slug,
        coverImage: book.coverImageUrl || book.pdfCoverImageUrl,
        price: Number(book.price),
        currency: book.currency,
        status: book.status,
        isFeatured: book.isFeatured,
        isStaffPick: book.isStaffPick,
        stats: {
          purchases: book.purchaseCount,
          views: book.viewCount,
          revenue: Number(book.price) * book.purchaseCount,
        },
        createdAt: book.createdAt.toISOString(),
        publishedAt: book.publishedAt?.toISOString() || null,
        rejectionReason: book.rejectionReason,
      })),
    });
  } catch (error) {
    creatorMarketplaceBooksLogger.error({ err: String(error) }, "Error fetching creator books:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
