import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// CORS headers for API responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
  showPrimaryButton: true,
  secondaryButtonText: "Start a Project",
  secondaryButtonLink: "/projects/new",
  showSecondaryButton: true,
  mediaType: "IMAGE" as const,
  imageUrl: null,
  videoUrl: null,
  videoThumbnail: null,
  videoAutoplay: true,
  videoMuted: true,
  videoLoop: true,
  textAlignment: "center",
  overlayOpacity: 0,
  textColor: "white",
  showSubtitle: true,
  showDescription: true,
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
        showPrimaryButton: true,
        secondaryButtonText: true,
        secondaryButtonLink: true,
        showSecondaryButton: true,
        mediaType: true,
        imageUrl: true,
        videoUrl: true,
        videoThumbnail: true,
        videoAutoplay: true,
        videoMuted: true,
        videoLoop: true,
        textAlignment: true,
        overlayOpacity: true,
        textColor: true,
        showSubtitle: true,
        showDescription: true,
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
          showPrimaryButton: newSlide.showPrimaryButton,
          secondaryButtonText: newSlide.secondaryButtonText,
          secondaryButtonLink: newSlide.secondaryButtonLink,
          showSecondaryButton: newSlide.showSecondaryButton,
          mediaType: newSlide.mediaType,
          imageUrl: newSlide.imageUrl,
          videoUrl: newSlide.videoUrl,
          videoThumbnail: newSlide.videoThumbnail,
          videoAutoplay: newSlide.videoAutoplay,
          videoMuted: newSlide.videoMuted,
          videoLoop: newSlide.videoLoop,
          textAlignment: newSlide.textAlignment,
          overlayOpacity: newSlide.overlayOpacity,
          textColor: newSlide.textColor,
          showSubtitle: newSlide.showSubtitle,
          showDescription: newSlide.showDescription,
        }];
      }
    }

    return NextResponse.json({ slides }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error fetching hero slides:", error);
    return NextResponse.json({ slides: [] }, { headers: corsHeaders });
  }
}
