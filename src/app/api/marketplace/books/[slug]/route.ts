import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/marketplace/books/[slug]
 *
 * Get a single book by slug
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const book = await prisma.marketplaceBook.findFirst({
      where: {
        slug,
        deletedAt: null,
        status: { in: ["LIVE", "APPROVED"] },
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
            bio: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            bannerImageUrl: true,
            tagline: true,
          },
        },
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Increment view count
    await prisma.marketplaceBook.update({
      where: { id: book.id },
      data: { viewCount: { increment: 1 } },
    });

    // Check if user has purchased this book
    let hasPurchased = false;
    const session = await auth();
    if (session?.user?.id) {
      const purchase = await prisma.marketplacePurchase.findFirst({
        where: {
          bookId: book.id,
          buyerId: session.user.id,
          status: "COMPLETED",
        },
      });
      hasPurchased = !!purchase;
    }

    return NextResponse.json({
      book: {
        id: book.id,
        title: book.title,
        slug: book.slug,
        description: book.description,
        shortDescription: book.shortDescription,
        coverImage: book.coverImageUrl || book.pdfCoverImageUrl,
        videoUrl: book.promoVideoUrl,
        galleryImages: book.galleryImages,
        price: Number(book.price),
        currency: book.currency,
        category: book.category,
        tags: book.tags,
        stats: {
          purchases: book.purchaseCount,
          views: book.viewCount,
        },
        isFeatured: book.isFeatured,
        isStaffPick: book.isStaffPick,
        publishedAt: book.publishedAt,
        hasAdultContent: book.hasAdultContent,
        hasRiskyContent: book.hasRiskyContent,
        paymentProcessor: book.paymentProcessor,
        creator: {
          id: book.creator.id,
          name: book.creator.name,
          avatar: book.creator.image,
          bio: book.creator.bio,
        },
        company: book.company
          ? {
              id: book.company.id,
              name: book.company.name,
              slug: book.company.slug,
              logo: book.company.logoUrl,
              banner: book.company.bannerImageUrl,
              tagline: book.company.tagline,
            }
          : null,
      },
      hasPurchased,
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
 * PUT /api/marketplace/books/[slug]
 *
 * Update a book (creator only)
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    // Find the book
    const book = await prisma.marketplaceBook.findFirst({
      where: {
        slug,
        deletedAt: null,
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Check ownership
    if (book.creatorId !== session.user.id) {
      // Check if admin
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (!user || !["SUPER_ADMIN", "ADMIN"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Can only edit DRAFT or REJECTED books
    if (!["DRAFT", "REJECTED"].includes(book.status)) {
      return NextResponse.json(
        { error: "Cannot edit a published book" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      shortDescription,
      coverImageUrl,
      promoVideoUrl,
      galleryImages,
      price,
      currency,
      pdfFileUrl,
      pdfFileName,
      pdfFileSize,
      category,
      tags,
      hasAdultContent,
      hasRiskyContent,
      promoContentSfw,
    } = body;

    // Determine payment processor based on content flags
    const paymentProcessor =
      (hasAdultContent ?? book.hasAdultContent) ||
      (hasRiskyContent ?? book.hasRiskyContent)
        ? "DIVINITYCOIN"
        : "STRIPE";

    const updatedBook = await prisma.marketplaceBook.update({
      where: { id: book.id },
      data: {
        title: title ?? book.title,
        description: description ?? book.description,
        shortDescription: shortDescription ?? book.shortDescription,
        coverImageUrl: coverImageUrl ?? book.coverImageUrl,
        promoVideoUrl: promoVideoUrl ?? book.promoVideoUrl,
        galleryImages: galleryImages ?? book.galleryImages,
        price: price ?? book.price,
        currency: currency ?? book.currency,
        pdfFileUrl: pdfFileUrl ?? book.pdfFileUrl,
        pdfFileName: pdfFileName ?? book.pdfFileName,
        pdfFileSize: pdfFileSize ?? book.pdfFileSize,
        category: category ?? book.category,
        tags: tags ?? book.tags,
        hasAdultContent: hasAdultContent ?? book.hasAdultContent,
        hasRiskyContent: hasRiskyContent ?? book.hasRiskyContent,
        promoContentSfw: promoContentSfw ?? book.promoContentSfw,
        paymentProcessor,
      },
    });

    return NextResponse.json({ book: updatedBook });
  } catch (error) {
    console.error("Error updating book:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/marketplace/books/[slug]
 *
 * Soft delete a book (creator only)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    // Find the book
    const book = await prisma.marketplaceBook.findFirst({
      where: {
        slug,
        deletedAt: null,
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Check ownership
    if (book.creatorId !== session.user.id) {
      // Check if admin
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (!user || !["SUPER_ADMIN", "ADMIN"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Soft delete
    await prisma.marketplaceBook.update({
      where: { id: book.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting book:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
