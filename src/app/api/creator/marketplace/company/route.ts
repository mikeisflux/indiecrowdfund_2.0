import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/creator/marketplace/company
 *
 * Get creator's company profile
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const company = await prisma.companyProfile.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    if (!company) {
      return NextResponse.json({ error: "No company profile found" }, { status: 404 });
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
      },
    });
  } catch (error) {
    console.error("Error fetching company:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/creator/marketplace/company
 *
 * Create a company profile
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user already has a company
    const existingCompany = await prisma.companyProfile.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    if (existingCompany) {
      return NextResponse.json(
        { error: "You already have a company profile" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, slug, tagline, about, logo, banner, website, socialLinks } = body;

    // Validation
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    if (!slug?.trim()) {
      return NextResponse.json(
        { error: "URL slug is required" },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const slugExists = await prisma.companyProfile.findUnique({
      where: {
        slug: slug.toLowerCase(),
      },
    });

    if (slugExists) {
      return NextResponse.json(
        { error: "This URL slug is already taken" },
        { status: 400 }
      );
    }

    // Create company
    const company = await prisma.companyProfile.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        slug: slug.toLowerCase(),
        tagline: tagline?.trim() || null,
        about: about || null,
        logoUrl: logo || null,
        bannerImageUrl: banner || null,
        website: website?.trim() || null,
        socialLinks: socialLinks || {},
      },
    });

    // Update user's existing marketplace books to use this company
    await prisma.marketplaceBook.updateMany({
      where: {
        creatorId: session.user.id,
        companyId: null,
        deletedAt: null,
      },
      data: {
        companyId: company.id,
      },
    });

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
    });
  } catch (error) {
    console.error("Error creating company:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/creator/marketplace/company
 *
 * Update company profile
 */
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const company = await prisma.companyProfile.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Company profile not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, tagline, about, logo, banner, website, socialLinks } = body;

    // Validation
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    // Update company (slug cannot be changed)
    await prisma.companyProfile.update({
      where: { id: company.id },
      data: {
        name: name.trim(),
        tagline: tagline?.trim() || null,
        about: about || null,
        logoUrl: logo || null,
        bannerImageUrl: banner || null,
        website: website?.trim() || null,
        socialLinks: socialLinks || {},
      },
    });

    return NextResponse.json({
      success: true,
      message: "Company profile updated",
    });
  } catch (error) {
    console.error("Error updating company:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
