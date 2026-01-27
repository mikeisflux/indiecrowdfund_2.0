import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

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

// GET - List active hero slides (public)
export async function GET() {
  try {
    let slides = await db.heroSlide.findMany({
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

    // If no slides exist, create the default slide
    if (slides.length === 0) {
      const totalCount = await db.heroSlide.count();
      if (totalCount === 0) {
        const newSlide = await db.heroSlide.create({
          data: defaultSlideData,
        });
        slides = [{
          id: newSlide.id,
          title: newSlide.title,
          subtitle: newSlide.subtitle,
          description: newSlide.description,
          buttonText: newSlide.buttonText,
          buttonLink: newSlide.buttonLink,
          secondaryButtonText: newSlide.secondaryButtonText,
          secondaryButtonLink: newSlide.secondaryButtonLink,
          mediaType: newSlide.mediaType,
          imageUrl: newSlide.imageUrl,
          videoUrl: newSlide.videoUrl,
          videoThumbnail: newSlide.videoThumbnail,
          textAlignment: newSlide.textAlignment,
          overlayOpacity: newSlide.overlayOpacity,
        }];
      }
    }

    return NextResponse.json({ slides });
  } catch (error) {
    console.error("Error fetching hero slides:", error);
    return NextResponse.json({ slides: [] });
  }
}
