import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const slides = await db.heroSlide.findMany({
      orderBy: { sortOrder: "asc" },
    });

    const activeCount = slides.filter((s: { isActive: boolean }) => s.isActive).length;

    return NextResponse.json({
      slides,
      stats: {
        total: slides.length,
        active: activeCount,
        inactive: slides.length - activeCount,
      },
    });
  } catch (error) {
    console.error("Error fetching hero slides:", error);
    return NextResponse.json({ error: "Failed to fetch hero slides" }, { status: 500 });
  }
}

// POST - Create a new hero slide
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      title,
      subtitle,
      description,
      buttonText,
      buttonLink,
      secondaryButtonText,
      secondaryButtonLink,
      mediaType,
      imageUrl,
      videoUrl,
      videoThumbnail,
      textAlignment,
      overlayOpacity,
      isActive,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
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
        secondaryButtonText: secondaryButtonText || null,
        secondaryButtonLink: secondaryButtonLink || null,
        mediaType: mediaType || "IMAGE",
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        videoThumbnail: videoThumbnail || null,
        textAlignment: textAlignment || "center",
        overlayOpacity: overlayOpacity ?? 0,
        isActive: isActive ?? true,
        sortOrder: (lastSlide?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({ slide });
  } catch (error) {
    console.error("Error creating hero slide:", error);
    return NextResponse.json({ error: "Failed to create hero slide" }, { status: 500 });
  }
}

// PUT - Update a hero slide
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      secondaryButtonText,
      secondaryButtonLink,
      mediaType,
      imageUrl,
      videoUrl,
      videoThumbnail,
      textAlignment,
      overlayOpacity,
      isActive,
      sortOrder,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Slide ID is required" }, { status: 400 });
    }

    const existing = await db.heroSlide.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    const slide = await db.heroSlide.update({
      where: { id },
      data: {
        title: title ?? existing.title,
        subtitle: subtitle !== undefined ? subtitle : existing.subtitle,
        description: description !== undefined ? description : existing.description,
        buttonText: buttonText !== undefined ? buttonText : existing.buttonText,
        buttonLink: buttonLink !== undefined ? buttonLink : existing.buttonLink,
        secondaryButtonText: secondaryButtonText !== undefined ? secondaryButtonText : existing.secondaryButtonText,
        secondaryButtonLink: secondaryButtonLink !== undefined ? secondaryButtonLink : existing.secondaryButtonLink,
        mediaType: mediaType ?? existing.mediaType,
        imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl,
        videoUrl: videoUrl !== undefined ? videoUrl : existing.videoUrl,
        videoThumbnail: videoThumbnail !== undefined ? videoThumbnail : existing.videoThumbnail,
        textAlignment: textAlignment ?? existing.textAlignment,
        overlayOpacity: overlayOpacity !== undefined ? overlayOpacity : existing.overlayOpacity,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
      },
    });

    return NextResponse.json({ slide });
  } catch (error) {
    console.error("Error updating hero slide:", error);
    return NextResponse.json({ error: "Failed to update hero slide" }, { status: 500 });
  }
}

// DELETE - Delete a hero slide
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Slide ID is required" }, { status: 400 });
    }

    await db.heroSlide.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting hero slide:", error);
    return NextResponse.json({ error: "Failed to delete hero slide" }, { status: 500 });
  }
}

// PATCH - Reorder slides
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { slideIds } = body;

    if (!Array.isArray(slideIds)) {
      return NextResponse.json({ error: "slideIds must be an array" }, { status: 400 });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering slides:", error);
    return NextResponse.json({ error: "Failed to reorder slides" }, { status: 500 });
  }
}
