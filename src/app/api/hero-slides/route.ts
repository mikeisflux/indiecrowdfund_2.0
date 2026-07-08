import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const heroSlidesLogger = logger.child({ module: "hero-slides" });
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
  buttonLink: "/crowdfunds",
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

    // If no slides exist, create the default slide. Guard this seed with
    // an advisory lock keyed to the fixed string 'seed-hero-slides' so
    // two concurrent homepage loads can't both find 0 slides and both
    // insert a default row — leaving duplicate default slides that the
    // admin would then have to manually clean up.
    if (slides.length === 0) {
      const seeded = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('seed-hero-slides'))`;
        const totalCount = await tx.heroSlide.count();
        if (totalCount > 0) {
          // Another request seeded while we were waiting — fall through
          // and let the caller re-read from the now-populated table.
          return null;
        }
        return tx.heroSlide.create({
          data: defaultSlideData,
        });
      });

      if (seeded) {
        slides = [{
          id: seeded.id,
          title: seeded.title,
          subtitle: seeded.subtitle,
          description: seeded.description,
          buttonText: seeded.buttonText,
          buttonLink: seeded.buttonLink,
          showPrimaryButton: seeded.showPrimaryButton,
          secondaryButtonText: seeded.secondaryButtonText,
          secondaryButtonLink: seeded.secondaryButtonLink,
          showSecondaryButton: seeded.showSecondaryButton,
          mediaType: seeded.mediaType,
          imageUrl: seeded.imageUrl,
          videoUrl: seeded.videoUrl,
          videoThumbnail: seeded.videoThumbnail,
          videoAutoplay: seeded.videoAutoplay,
          videoMuted: seeded.videoMuted,
          videoLoop: seeded.videoLoop,
          textAlignment: seeded.textAlignment,
          overlayOpacity: seeded.overlayOpacity,
          textColor: seeded.textColor,
          showSubtitle: seeded.showSubtitle,
          showDescription: seeded.showDescription,
        }];
      }
    }

    return NextResponse.json({ slides }, { headers: corsHeaders });
  } catch (error) {
    heroSlidesLogger.error({ err: formatError(error) }, "Error fetching hero slides:");
    return NextResponse.json({ slides: [] }, { headers: corsHeaders });
  }
}
