import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const marketplaceCompaniesLogger = logger.child({ module: "marketplace-companies" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace/companies
 *
 * List all active companies with marketplace books
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search");

    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      isActive: true,
      books: {
        some: {
          status: "LIVE",
          deletedAt: null,
        },
      },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { tagline: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count
    const total = await prisma.companyProfile.count({ where });

    // Get companies
    const companies = await prisma.companyProfile.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        logoUrl: true,
        bannerImageUrl: true,
        isVerified: true,
        bookCount: true,
        totalSales: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            books: {
              where: {
                status: "LIVE",
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: [{ totalSales: "desc" }, { bookCount: "desc" }],
      skip,
      take: limit,
    });

    type CompanyType = (typeof companies)[number];
    const transformedCompanies = companies.map((company: CompanyType) => ({
      id: company.id,
      name: company.name,
      slug: company.slug,
      tagline: company.tagline,
      logo: company.logoUrl,
      banner: company.bannerImageUrl,
      isVerified: company.isVerified,
      stats: {
        books: company._count.books,
        totalSales: company.totalSales,
      },
      owner: {
        id: company.user.id,
        name: company.user.name,
      },
    }));

    return NextResponse.json({
      companies: transformedCompanies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    marketplaceCompaniesLogger.error({ err: String(error) }, "Error fetching companies:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/marketplace/companies
 *
 * Create or update company profile (creator only)
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, tagline, about, logoUrl, bannerImageUrl, website, socialLinks } =
      body;

    if (!name) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    // Generate slug
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check for existing slug (excluding current user's company)
    const existingCompany = await prisma.companyProfile.findFirst({
      where: {
        slug: baseSlug,
        userId: { not: session.user.id },
      },
    });

    const slug = existingCompany
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;

    // Upsert company profile
    const company = await prisma.companyProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        name,
        slug,
        tagline,
        about,
        logoUrl,
        bannerImageUrl,
        website,
        socialLinks,
      },
      update: {
        name,
        tagline,
        about,
        logoUrl,
        bannerImageUrl,
        website,
        socialLinks,
      },
    });

    return NextResponse.json({ company });
  } catch (error) {
    marketplaceCompaniesLogger.error({ err: String(error) }, "Error creating/updating company:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
