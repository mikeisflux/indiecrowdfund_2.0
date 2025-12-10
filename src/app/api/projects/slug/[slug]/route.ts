import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const project = await db.project.findUnique({
      where: { slug: params.slug },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
            bio: true,
            location: true,
            _count: {
              select: {
                createdProjects: true,
                pledges: true,
              },
            },
          },
        },
        rewards: {
          include: {
            items: true,
          },
          orderBy: { amount: "asc" },
        },
        updates: {
          where: { status: "PUBLISHED" },
          orderBy: { publishedAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            pledges: true,
            followers: true,
            comments: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Calculate days remaining
    let daysRemaining = 0;
    if (project.endDate) {
      const now = new Date();
      const end = new Date(project.endDate);
      daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // Transform to the expected format - include ALL fields needed for editing
    const formattedProject = {
      id: project.id,
      title: project.title,
      subtitle: project.subtitle || "",
      slug: project.slug,
      // Categories
      category: project.category,
      subcategory: project.subcategory || "",
      secondaryCategory: project.secondaryCategory || "",
      secondarySubcategory: project.secondarySubcategory || "",
      // Location & Media
      location: project.location || "",
      imageUrl: project.imageUrl || "",
      videoUrl: project.videoUrl || "",
      isProjectWeLove: false,
      // Story
      description: project.description,
      risks: project.risks,
      usesAI: project.usesAI,
      faqs: (project.faqs as { question: string; answer: string }[]) || [],
      // Funding
      goalAmount: project.goalAmount,
      currentAmount: project.currentAmount,
      backerCount: project.backerCount,
      // Duration
      durationType: project.durationType,
      durationDays: project.durationDays,
      endDate: project.endDate,
      launchDate: project.launchDate,
      launchedAt: project.launchedAt,
      daysRemaining,
      // Payment settings
      projectType: project.projectType,
      hasAdultContent: project.hasAdultContent,
      hasRiskyContent: project.hasRiskyContent,
      promoContentSfw: project.promoContentSfw,
      allowRetailerPledges: project.allowRetailerPledges,
      retailerDiscount: project.retailerDiscount,
      retailerMinQuantity: project.retailerMinQuantity,
      // Promotion settings
      prelaunchActive: project.prelaunchActive,
      prelaunchDescription: project.prelaunchDescription || "",
      customReferralTags: project.customReferralTags || [],
      googleAnalyticsId: project.googleAnalyticsId || "",
      metaPixelId: project.metaPixelId || "",
      // Status
      status: project.status,
      // Creator
      creator: {
        id: project.creator.id,
        name: project.creator.name || "Creator",
        image: project.creator.image || "",
        bio: project.creator.bio || "",
        location: project.creator.location || "",
        projectsCreated: project.creator._count.createdProjects,
        projectsBacked: project.creator._count.pledges,
      },
      // Updates and comments
      updates: project.updates.map((u: { id: string; title: string; content: string; publishedAt: Date | null; createdAt: Date }) => ({
        id: u.id,
        title: u.title,
        content: u.content,
        createdAt: u.publishedAt || u.createdAt,
      })),
      comments: project._count.comments,
    };

    // Transform rewards - include ALL fields needed for editing
    interface RewardItem {
      id: string;
      title: string;
      description: string | null;
      imageUrl: string | null;
    }
    interface Reward {
      id: string;
      type: string;
      title: string;
      description: string;
      amount: number;
      estimatedDelivery: Date | null;
      shippingType: string;
      shippingCountries: string[];
      shippingCost: number | null;
      quantityAvailable: number | null;
      quantityClaimed: number;
      visibility: string;
      imageUrl: string | null;
      items: RewardItem[];
      isEnded: boolean;
      endedAt: Date | null;
    }
    const formattedRewards = project.rewards.map((r: Reward) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      amount: r.amount,
      estimatedDelivery: r.estimatedDelivery,
      shippingType: r.shippingType,
      shippingCountries: r.shippingCountries || [],
      shippingLocation: r.shippingCountries.length > 0 ? r.shippingCountries.join(", ") : "Worldwide",
      shippingCost: r.shippingCost || 0,
      quantityAvailable: r.quantityAvailable,
      quantityClaimed: r.quantityClaimed || 0,
      visibility: r.visibility || "PUBLIC",
      imageUrl: r.imageUrl || "",
      items: r.items.map((i: RewardItem) => ({
        id: i.id,
        title: i.title,
        description: i.description || "",
        imageUrl: i.imageUrl || "",
        quantity: 1,
      })),
      isEnded: r.isEnded || false,
      endedAt: r.endedAt,
    }));

    // Separate tiers and addons
    const tiers = formattedRewards.filter((r: { type: string }) => r.type === "TIER");
    const addons = formattedRewards.filter((r: { type: string }) => r.type === "ADDON");

    return NextResponse.json({
      project: formattedProject,
      rewards: tiers,
      addons,
    });
  } catch (error) {
    console.error("Get project by slug error:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}
