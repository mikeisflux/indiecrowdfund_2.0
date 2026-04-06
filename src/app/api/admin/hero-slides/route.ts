import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminHeroSlidesLogger = logger.child({ module: "admin-hero-slides" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// CORS headers for API responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Default slide content matching the original hero
const defaultSlideData = {
  title: "Support Who You Love",
  subtitle: "IndieCrowdfund leads the way!",
  description: "IndieCrowdfund is the future home to thousands of creative projects in art, design, film, games, music, and more. Back a project or start your own today.",
  buttonText: "Discover Projects",
  buttonLink: "/discover",
  secondaryButtonText: "Start a Project",
  secondaryButtonLink: "/projects/new",
  mediaType: "IMAGE" as const,
  imageUrl: null,
  videoUrl: null,
  videoThumbnail: null,
  textAlignment: "center",
  overlayOpacity: 0,
  isActive: true,
  sortOrder: 0,
};

// Require admin access
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, id: true },
  });

  if (!user || user.role !== "SUPER_ADMIN") {
    return null;
  }

  return { ...session.user, id: user.id };
}

// GET - List all hero slides
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    let slides = await db.heroSlide.findMany({
      orderBy: { sortOrder: "asc" },
    });

    // If no slides exist, create the default slide
    if (slides.length === 0) {
      const newSlide = await db.heroSlide.create({
        data: defaultSlideData,
      });
      slides = [newSlide];
    }

    const activeCount = slides.filter((s: { isActive: boolean }) => s.isActive).length;

    return NextResponse.json({
      slides,
      stats: {
        total: slides.length,
        active: activeCount,
        inactive: slides.length - activeCount,
      },
    }, { headers: corsHeaders });
  } catch (error) {
    adminHeroSlidesLogger.error({ err: String(error) }, "Error fetching hero slides:");
    return NextResponse.json({ error: "Failed to fetch hero slides" }, { status: 500, headers: corsHeaders });
  }
}

// POST - Create a new hero slide
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const {
      title,
      subtitle,
      description,
      buttonText,
      buttonLink,
      showPrimaryButton,
      secondaryButtonText,
      secondaryButtonLink,
      showSecondaryButton,
      mediaType,
      imageUrl,
      videoUrl,
      videoThumbnail,
      videoAutoplay,
      videoMuted,
      videoLoop,
      textAlignment,
      overlayOpacity,
      textColor,
      showSubtitle,
      showDescription,
      isActive,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400, headers: corsHeaders });
    }

    // Get the highest sort order
    const lastSlide = await db.heroSlide.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const slide = await db.heroSlide.create({
      data: {
        title,
        subtitle: subtitle || null,
        description: description || null,
        buttonText: buttonText || null,
        buttonLink: buttonLink || null,
        showPrimaryButton: showPrimaryButton ?? true,
        secondaryButtonText: secondaryButtonText || null,
        secondaryButtonLink: secondaryButtonLink || null,
        showSecondaryButton: showSecondaryButton ?? true,
        mediaType: mediaType || "IMAGE",
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        videoThumbnail: videoThumbnail || null,
        videoAutoplay: videoAutoplay ?? true,
        videoMuted: videoMuted ?? true,
        videoLoop: videoLoop ?? true,
        textAlignment: textAlignment || "center",
        overlayOpacity: overlayOpacity ?? 0,
        textColor: textColor || "white",
        showSubtitle: showSubtitle ?? true,
        showDescription: showDescription ?? true,
        isActive: isActive ?? true,
        sortOrder: (lastSlide?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({ slide }, { headers: corsHeaders });
  } catch (error) {
    adminHeroSlidesLogger.error({ err: String(error) }, "Error creating hero slide:");
    return NextResponse.json({ error: "Failed to create hero slide" }, { status: 500, headers: corsHeaders });
  }
}

// PUT - Update a hero slide
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const {
      id,
      title,
      subtitle,
      description,
      buttonText,
      buttonLink,
      showPrimaryButton,
      secondaryButtonText,
      secondaryButtonLink,
      showSecondaryButton,
      mediaType,
      imageUrl,
      videoUrl,
      videoThumbnail,
      videoAutoplay,
      videoMuted,
      videoLoop,
      textAlignment,
      overlayOpacity,
      textColor,
      showSubtitle,
      showDescription,
      isActive,
      sortOrder,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Slide ID is required" }, { status: 400, headers: corsHeaders });
    }

    const existing = await db.heroSlide.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404, headers: corsHeaders });
    }

    const slide = await db.heroSlide.update({
      where: { id },
      data: {
        title: title ?? existing.title,
        subtitle: subtitle !== undefined ? subtitle : existing.subtitle,
        description: description !== undefined ? description : existing.description,
        buttonText: buttonText !== undefined ? buttonText : existing.buttonText,
        buttonLink: buttonLink !== undefined ? buttonLink : existing.buttonLink,
        showPrimaryButton: showPrimaryButton !== undefined ? showPrimaryButton : existing.showPrimaryButton,
        secondaryButtonText: secondaryButtonText !== undefined ? secondaryButtonText : existing.secondaryButtonText,
        secondaryButtonLink: secondaryButtonLink !== undefined ? secondaryButtonLink : existing.secondaryButtonLink,
        showSecondaryButton: showSecondaryButton !== undefined ? showSecondaryButton : existing.showSecondaryButton,
        mediaType: mediaType ?? existing.mediaType,
        imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl,
        videoUrl: videoUrl !== undefined ? videoUrl : existing.videoUrl,
        videoThumbnail: videoThumbnail !== undefined ? videoThumbnail : existing.videoThumbnail,
        videoAutoplay: videoAutoplay !== undefined ? videoAutoplay : existing.videoAutoplay,
        videoMuted: videoMuted !== undefined ? videoMuted : existing.videoMuted,
        videoLoop: videoLoop !== undefined ? videoLoop : existing.videoLoop,
        textAlignment: textAlignment ?? existing.textAlignment,
        overlayOpacity: overlayOpacity !== undefined ? overlayOpacity : existing.overlayOpacity,
        textColor: textColor !== undefined ? textColor : existing.textColor,
        showSubtitle: showSubtitle !== undefined ? showSubtitle : existing.showSubtitle,
        showDescription: showDescription !== undefined ? showDescription : existing.showDescription,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
      },
    });

    return NextResponse.json({ slide }, { headers: corsHeaders });
  } catch (error) {
    adminHeroSlidesLogger.error({ err: String(error) }, "Error updating hero slide:");
    return NextResponse.json({ error: "Failed to update hero slide" }, { status: 500, headers: corsHeaders });
  }
}

// DELETE - Delete a hero slide
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Slide ID is required" }, { status: 400, headers: corsHeaders });
    }

    const existing = await db.heroSlide.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404, headers: corsHeaders });
    }

    await db.heroSlide.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    adminHeroSlidesLogger.error({ err: String(error) }, "Error deleting hero slide:");
    return NextResponse.json({ error: "Failed to delete hero slide" }, { status: 500, headers: corsHeaders });
  }
}

// PATCH - Reorder slides
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { slideIds } = body;

    if (!Array.isArray(slideIds)) {
      return NextResponse.json({ error: "slideIds must be an array" }, { status: 400, headers: corsHeaders });
    }

    // Update sort order for each slide
    await Promise.all(
      slideIds.map((id: string, index: number) =>
        db.heroSlide.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    adminHeroSlidesLogger.error({ err: String(error) }, "Error reordering slides:");
    return NextResponse.json({ error: "Failed to reorder slides" }, { status: 500, headers: corsHeaders });
  }
}
