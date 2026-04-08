import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const seedLogger = logger.child({ module: "hero-slides-seed-features" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

const featureSlides = [
  {
    title: "Creator Ratings You Can Trust",
    subtitle: "Transparent satisfaction scores for every creator",
    description:
      "Every creator on IndieCrowdfund has a public satisfaction rating built from real backer reviews. See overall scores, delivery speed, product quality, and communication — all at a glance before you back.",
    buttonText: "Browse Creators",
    buttonLink: "/discover",
    showPrimaryButton: true,
    secondaryButtonText: "Start Your Project",
    secondaryButtonLink: "/projects/new",
    showSecondaryButton: true,
    mediaType: "IMAGE" as const,
    textAlignment: "center",
    overlayOpacity: 0,
    textColor: "white",
    showSubtitle: true,
    showDescription: true,
    isActive: true,
  },
  {
    title: "Read Comics & Books Right Here",
    subtitle: "Immersive page-flip digital reader",
    description:
      "Back a project with digital rewards and read them instantly in our built-in page-flip reader. Bookmarks, zoom, fullscreen, and realistic page-turning — no extra apps needed.",
    buttonText: "Explore Projects",
    buttonLink: "/discover",
    showPrimaryButton: true,
    secondaryButtonText: "Learn More",
    secondaryButtonLink: "/discover",
    showSecondaryButton: false,
    mediaType: "IMAGE" as const,
    textAlignment: "center",
    overlayOpacity: 0,
    textColor: "white",
    showSubtitle: true,
    showDescription: true,
    isActive: true,
  },
  {
    title: "Launch a Campaign in Minutes",
    subtitle: "Drag-and-drop images, instant preview, zero friction",
    description:
      "Our campaign builder makes it effortless — drag and drop images, write your story, set reward tiers, and go live. No design skills required. Just your idea and a few clicks.",
    buttonText: "Start a Project",
    buttonLink: "/projects/new",
    showPrimaryButton: true,
    secondaryButtonText: "See Live Campaigns",
    secondaryButtonLink: "/discover",
    showSecondaryButton: true,
    mediaType: "IMAGE" as const,
    textAlignment: "center",
    overlayOpacity: 0,
    textColor: "white",
    showSubtitle: true,
    showDescription: true,
    isActive: true,
  },
  {
    title: "Smart Add-Ons & Reward Import",
    subtitle: "Reuse rewards across campaigns with one click",
    description:
      "Running multiple campaigns? Import your best-selling rewards and add-ons from any previous project. Build your catalog once, use it everywhere — backers love the consistency.",
    buttonText: "Create a Campaign",
    buttonLink: "/projects/new",
    showPrimaryButton: true,
    secondaryButtonText: "Discover Projects",
    secondaryButtonLink: "/discover",
    showSecondaryButton: true,
    mediaType: "IMAGE" as const,
    textAlignment: "center",
    overlayOpacity: 0,
    textColor: "white",
    showSubtitle: true,
    showDescription: true,
    isActive: true,
  },
  {
    title: "Your Digital Library, Always Available",
    subtitle: "Every digital reward in one place",
    description:
      "All your backed digital content — comics, art, music, ebooks — lives in your personal library. Track reading progress, manage bookmarks, and download anytime. It's your collection, forever.",
    buttonText: "Back a Project",
    buttonLink: "/discover",
    showPrimaryButton: true,
    secondaryButtonText: "Start Creating",
    secondaryButtonLink: "/projects/new",
    showSecondaryButton: true,
    mediaType: "IMAGE" as const,
    textAlignment: "center",
    overlayOpacity: 0,
    textColor: "white",
    showSubtitle: true,
    showDescription: true,
    isActive: true,
  },
  {
    title: "Real-Time Creator Dashboard",
    subtitle: "Analytics, fulfillment tracking, and backer insights",
    description:
      "Creators get a powerful dashboard with real-time pledge analytics, fulfillment status tracking, shipping management, and direct backer messaging — everything you need to deliver on your promises.",
    buttonText: "Start Your Project",
    buttonLink: "/projects/new",
    showPrimaryButton: true,
    secondaryButtonText: "Explore Platform",
    secondaryButtonLink: "/discover",
    showSecondaryButton: true,
    mediaType: "IMAGE" as const,
    textAlignment: "center",
    overlayOpacity: 0,
    textColor: "white",
    showSubtitle: true,
    showDescription: true,
    isActive: true,
  },
  {
    title: "Direct Messaging Built In",
    subtitle: "Connect creators and backers instantly",
    description:
      "No more hunting through email threads. Our built-in messaging system lets backers ask questions and creators share updates — all organized by project with read receipts and notifications.",
    buttonText: "Join the Community",
    buttonLink: "/discover",
    showPrimaryButton: true,
    secondaryButtonText: "Start a Campaign",
    secondaryButtonLink: "/projects/new",
    showSecondaryButton: true,
    mediaType: "IMAGE" as const,
    textAlignment: "center",
    overlayOpacity: 0,
    textColor: "white",
    showSubtitle: true,
    showDescription: true,
    isActive: true,
  },
  {
    title: "NSFW Guaranteed Friendly Payments",
    subtitle: "Powered by Divinity Coin and Whop",
    description:
      "No more payment processor headaches for adult content creators. IndieCrowdfund supports NSFW-friendly payments through Divinity Coin and Whop — so you can fund your projects without restrictions or surprise account freezes.",
    buttonText: "Discover Projects",
    buttonLink: "/discover",
    showPrimaryButton: true,
    secondaryButtonText: "Start a Project",
    secondaryButtonLink: "/projects/new",
    showSecondaryButton: true,
    mediaType: "IMAGE" as const,
    textAlignment: "center",
    overlayOpacity: 0,
    textColor: "white",
    showSubtitle: true,
    showDescription: true,
    isActive: true,
  },
];

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });

  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    // Get the current highest sort order
    const lastSlide = await db.heroSlide.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    let nextOrder = (lastSlide?.sortOrder ?? -1) + 1;

    const created: string[] = [];

    for (const slideData of featureSlides) {
      // Check if a slide with this exact title already exists to avoid duplicates
      const existing = await db.heroSlide.findFirst({
        where: { title: slideData.title },
      });

      if (existing) {
        continue;
      }

      const slide = await db.heroSlide.create({
        data: {
          ...slideData,
          sortOrder: nextOrder,
        },
      });

      created.push(slide.title);
      nextOrder++;
    }

    if (created.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: "All feature slides already exist — nothing to add",
          created: 0,
        },
        { headers: corsHeaders }
      );
    }

    seedLogger.info(
      { count: created.length },
      "Seeded feature hero slides"
    );

    return NextResponse.json(
      {
        success: true,
        message: `Created ${created.length} feature slides`,
        created: created.length,
        titles: created,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    seedLogger.error({ err: String(error) }, "Error seeding feature slides");
    return NextResponse.json(
      { error: "Failed to seed feature slides", details: String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}
