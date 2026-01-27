import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - List active hero slides (public)
export async function GET() {
  try {
    const slides = await db.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        subtitle: true,
        description: true,
        buttonText: true,
        buttonLink: true,
        secondaryButtonText: true,
        secondaryButtonLink: true,
        mediaType: true,
        imageUrl: true,
        videoUrl: true,
        videoThumbnail: true,
        textAlignment: true,
        overlayOpacity: true,
      },
    });

    return NextResponse.json({ slides });
  } catch (error) {
    console.error("Error fetching hero slides:", error);
    return NextResponse.json({ slides: [] });
  }
}
