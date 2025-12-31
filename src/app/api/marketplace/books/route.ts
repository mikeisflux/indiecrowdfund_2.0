import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search");

    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      status: "LIVE",
      deletedAt: null,
    };

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
    const transformedBooks = books.map((book) => ({
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
    console.error("Error fetching marketplace books:", error);
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

    // Check if user is a creator
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || !["CREATOR", "SUPER_ADMIN", "ADMIN"].includes(user.role)) {
      return NextResponse.json(
        { error: "Only creators can create marketplace books" },
        { status: 403 }
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

    // Validate required fields
    if (!title || !description || !price || !pdfFileUrl) {
      return NextResponse.json(
        { error: "Missing required fields: title, description, price, pdfFileUrl" },
        { status: 400 }
      );
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

    return NextResponse.json({ book }, { status: 201 });
  } catch (error) {
    console.error("Error creating marketplace book:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
