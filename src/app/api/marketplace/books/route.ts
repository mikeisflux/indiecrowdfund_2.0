import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const marketplaceBooksLogger = logger.child({ module: "marketplace-books" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace/books
 *
 * Public endpoint to list marketplace books
 * Supports filtering by featured, staff picks, category
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const featured = searchParams.get("featured") === "true";
    const staffPick = searchParams.get("staffPick") === "true";
    const mediaCategory = searchParams.get("mediaCategory");
    const category = searchParams.get("category");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const search = searchParams.get("search");

    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      status: "LIVE",
      deletedAt: null,
    };

    if (mediaCategory) {
      where.mediaCategory = mediaCategory;
    }

    if (featured) {
      where.isFeatured = true;
    }

    if (staffPick) {
      where.isStaffPick = true;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { shortDescription: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count
    const total = await prisma.marketplaceBook.count({ where });

    // Get books
    const books = await prisma.marketplaceBook.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        coverImageUrl: true,
        pdfCoverImageUrl: true,
        promoVideoUrl: true,
        price: true,
        currency: true,
        category: true,
        tags: true,
        mediaCategory: true,
        audioFileUrl: true,
        audioDuration: true,
        albumId: true,
        trackNumber: true,
        videoFileUrl: true,
        videoDuration: true,
        videoResolution: true,
        purchaseCount: true,
        viewCount: true,
        isFeatured: true,
        isStaffPick: true,
        featuredOrder: true,
        staffPickOrder: true,
        publishedAt: true,
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
      },
      orderBy: featured
        ? { featuredOrder: "asc" }
        : staffPick
        ? { staffPickOrder: "asc" }
        : { publishedAt: "desc" },
      skip,
      take: limit,
    });

    // Transform for response
    type BookType = (typeof books)[number];
    const transformedBooks = books.map((book: BookType) => ({
      id: book.id,
      title: book.title,
      slug: book.slug,
      description: book.shortDescription,
      coverImage: book.coverImageUrl || book.pdfCoverImageUrl,
      videoUrl: book.promoVideoUrl,
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
      // Audio fields (music)
      audioUrl: book.audioFileUrl ? `/api/marketplace/stream/${book.slug}` : undefined,
      audioDuration: book.audioDuration,
      albumId: book.albumId,
      trackNumber: book.trackNumber,
      // Video fields (movies)
      movieUrl: book.videoFileUrl ? `/api/marketplace/watch/${book.slug}` : undefined,
      videoDuration: book.videoDuration,
      videoResolution: book.videoResolution,
      creator: {
        id: book.creator.id,
        name: book.creator.name,
        avatar: book.creator.image,
      },
      company: book.company
        ? {
            id: book.company.id,
            name: book.company.name,
            slug: book.company.slug,
            logo: book.company.logoUrl,
          }
        : null,
    }));

    return NextResponse.json({
      books: transformedBooks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    marketplaceBooksLogger.error({ err: String(error) }, "Error fetching marketplace books:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/marketplace/books
 *
 * Create a new marketplace book (creator only)
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch current user role
    const user = await prisma.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
      currency = "USD",
      pdfFileUrl,
      pdfFileName,
      pdfFileSize,
      category,
      tags = [],
      hasAdultContent = false,
      hasRiskyContent = false,
      promoContentSfw = true,
      companyId,
    } = body;

    // Validate required fields and lengths
    if (!title || !description || !price || !pdfFileUrl) {
      return NextResponse.json(
        { error: "Missing required fields: title, description, price, pdfFileUrl" },
        { status: 400 }
      );
    }
    if (typeof title !== "string" || title.length > 500) {
      return NextResponse.json({ error: "Title must be 500 characters or less" }, { status: 400 });
    }
    if (typeof description !== "string" || description.length > 100000) {
      return NextResponse.json({ error: "Description must be 100000 characters or less" }, { status: 400 });
    }
    if (shortDescription && (typeof shortDescription !== "string" || shortDescription.length > 1000)) {
      return NextResponse.json({ error: "Short description must be 1000 characters or less" }, { status: 400 });
    }
    if (!Array.isArray(tags) || tags.length > 20 || tags.some((t: unknown) => typeof t !== "string" || t.length > 100)) {
      return NextResponse.json({ error: "Tags must be an array of up to 20 strings (max 100 chars each)" }, { status: 400 });
    }

    // Generate slug
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check for existing slug
    const existingBook = await prisma.marketplaceBook.findFirst({
      where: {
        creatorId: session.user.id,
        slug: baseSlug,
      },
    });

    const slug = existingBook
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;

    // Determine payment processor based on content flags
    const paymentProcessor =
      hasAdultContent || hasRiskyContent ? "DIVINITYCOIN" : "STRIPE";

    // Create book
    const book = await prisma.marketplaceBook.create({
      data: {
        creatorId: session.user.id,
        title,
        slug,
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
        paymentProcessor,
        companyId,
        status: "DRAFT",
      },
    });

    // Auto-promote user to CREATOR if they aren't already
    if (!["CREATOR", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { role: "CREATOR" },
      });
    }

    return NextResponse.json({ book }, { status: 201 });
  } catch (error) {
    marketplaceBooksLogger.error({ err: String(error) }, "Error creating marketplace book:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
