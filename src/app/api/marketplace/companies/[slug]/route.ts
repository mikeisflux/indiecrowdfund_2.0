import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/marketplace/companies/[slug]
 *
 * Get company profile with books
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const company = await prisma.companyProfile.findFirst({
      where: {
        slug,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            createdAt: true,
          },
        },
        books: {
          where: {
            status: "LIVE",
            deletedAt: null,
          },
          select: {
            id: true,
            title: true,
            slug: true,
            shortDescription: true,
            coverImageUrl: true,
            pdfCoverImageUrl: true,
            price: true,
            currency: true,
            category: true,
            purchaseCount: true,
            isFeatured: true,
            isStaffPick: true,
            publishedAt: true,
          },
          orderBy: { publishedAt: "desc" },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        tagline: company.tagline,
        about: company.about,
        logo: company.logoUrl,
        banner: company.bannerImageUrl,
        website: company.website,
        socialLinks: company.socialLinks,
        isVerified: company.isVerified,
        stats: {
          books: company.books.length,
          totalSales: company.totalSales,
        },
        owner: {
          id: company.user.id,
          name: company.user.name,
          avatar: company.user.image,
          memberSince: company.user.createdAt,
        },
        createdAt: company.createdAt,
      },
      books: company.books.map((book) => ({
        id: book.id,
        title: book.title,
        slug: book.slug,
        description: book.shortDescription,
        coverImage: book.coverImageUrl || book.pdfCoverImageUrl,
        price: Number(book.price),
        currency: book.currency,
        category: book.category,
        purchases: book.purchaseCount,
        isFeatured: book.isFeatured,
        isStaffPick: book.isStaffPick,
        publishedAt: book.publishedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching company:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
