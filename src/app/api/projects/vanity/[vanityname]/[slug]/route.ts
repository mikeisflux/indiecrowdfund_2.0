import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { vanityname: string; slug: string } }
) {
  try {
    // Get current user session (optional - for showing secret rewards to creators/admins)
    const session = await auth();
    const userId = session?.user?.id;
    const userRole = session?.user?.role;

    // Get secret token from query params (for accessing secret rewards)
    const { searchParams } = new URL(req.url);
    const secretToken = searchParams.get("secret");

    // First, find the creator by vanity URL
    const creator = await db.user.findUnique({
      where: { vanityUrl: params.vanityname },
      select: { id: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const project = await db.project.findFirst({
      where: {
        slug: params.slug,
        creatorId: creator.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
            bio: true,
            location: true,
            vanityUrl: true,
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
            _count: {
              select: { pledges: true },
            },
            // Get the first 5 backers for avatar display
            // Include COMPLETED and committed PENDING pledges
            pledges: {
              where: {
                OR: [
                  { status: "COMPLETED" },
                  {
                    // PENDING with saved payment method
                    status: "PENDING",
                    stripePaymentMethodId: { not: null },
                  },
                  {
                    // PENDING with confirmed checkout
                    status: "PENDING",
                    confirmationEmailSent: true,
                  },
                  {
                    // PENDING with SetupIntent (checkout was started)
                    status: "PENDING",
                    stripeSetupIntentId: { not: null },
                  },
                ],
              },
              take: 5,
              orderBy: { createdAt: "desc" },
              select: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
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
      goalAmount: Number(project.goalAmount),
      currentAmount: Number(project.currentAmount),
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
      creatorId: project.creatorId,
      creator: {
        id: project.creator.id,
        name: project.creator.name || "Creator",
        image: project.creator.image || "",
        bio: project.creator.bio || "",
        location: project.creator.location || "",
        vanityUrl: project.creator.vanityUrl || "",
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
      followers: project._count.followers,
    };

    // Transform rewards - include ALL fields needed for editing
    interface RewardItem {
      id: string;
      projectItemId: string | null;
      title: string;
      description: string | null;
      imageUrl: string | null;
    }
    interface RewardPledge {
      user: {
        id: string;
        name: string | null;
        image: string | null;
      };
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
      secretToken: string | null;
      imageUrl: string | null;
      items: RewardItem[];
      isEnded: boolean;
      endedAt: Date | null;
      _count?: { pledges: number };
      pledges?: RewardPledge[];
    }

    // Filter secret rewards - only show if:
    // 1. User is the creator
    // 2. User is an admin/superadmin
    // 3. User has the secret token
    const isCreator = userId === project.creator.id;
    const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

    const visibleRewards = project.rewards.filter((r: Reward) => {
      // Always show PUBLIC rewards
      if (r.visibility === "PUBLIC") return true;

      // Show SECRET rewards only if user is creator, admin, or has the token
      if (r.visibility === "SECRET") {
        if (isCreator || isAdmin) return true;
        if (secretToken && r.secretToken === secretToken) return true;
        return false;
      }

      return true;
    });

    const formattedRewards = visibleRewards.map((r: Reward) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      amount: Number(r.amount),
      estimatedDelivery: r.estimatedDelivery,
      shippingType: r.shippingType,
      shippingCountries: r.shippingCountries || [],
      shippingLocation: r.shippingCountries.length > 0 ? r.shippingCountries.join(", ") : "Worldwide",
      shippingCost: Number(r.shippingCost) || 0,
      quantityAvailable: r.quantityAvailable,
      quantityClaimed: r.quantityClaimed || 0,
      backerCount: r._count?.pledges || 0,
      // Include recent backer avatars for display
      backers: (r.pledges || []).map((p: RewardPledge) => ({
        id: p.user.id,
        name: p.user.name || "Backer",
        image: p.user.image || null,
      })),
      visibility: r.visibility || "PUBLIC",
      // Only include secretToken for creators/admins (so they can share the link)
      secretToken: (isCreator || isAdmin) ? r.secretToken : undefined,
      imageUrl: r.imageUrl || "",
      items: r.items.map((i: RewardItem) => ({
        id: i.id,
        projectItemId: i.projectItemId, // Include reference to ProjectItem for checkbox matching
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
    console.error("Get project by vanity URL error:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}
