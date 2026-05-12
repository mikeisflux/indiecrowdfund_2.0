import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const projectsVanityLogger = logger.child({ module: "projects-vanity" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getProjectStats } from "@/lib/stats";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vanityname: string; slug: string }> }
) {
  try {
    const { vanityname, slug } = await params;

    // Get current user session (optional - for showing secret rewards to creators/admins)
    const session = await auth();
    const userId = session?.user?.id;
    const userRole = session?.user?.role;

    // Get secret token from query params (for accessing secret rewards)
    const { searchParams } = new URL(req.url);
    const secretToken = searchParams.get("secret");

    // First, find the creator by vanity URL (exclude soft-deleted users)
    const creator = await db.user.findFirst({
      where: { vanityUrl: vanityname, deletedAt: null },
      select: { id: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const project = await db.project.findFirst({
      where: {
        slug: slug,
        creatorId: creator.id,
        deletedAt: null,
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
            // Count BOTH completed and pending pledges as "backers" so
            // the per-reward count matches Project.backerCount, which
            // also includes pending. AoN campaigns hold pledges in
            // PENDING (cards in vault) until the goal is hit — they're
            // real backers from a "people who pledged" standpoint even
            // before payment fires.
            _count: {
              select: {
                pledges: {
                  where: {
                    status: { in: ["COMPLETED", "PENDING"] },
                    deletedAt: null,
                  },
                },
              },
            },
            // Avatar display stays limited to COMPLETED so we don't
            // surface backers whose pledge could still fail at charge.
            pledges: {
              where: {
                status: "COMPLETED",
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

    // Restrict access to DRAFT/SUBMITTED projects — only creator, admin,
    // or an ACCEPTED ProjectCollaborator may preview, UNLESS the creator
    // has explicitly flipped prelaunchActive=true. In that case the
    // project opts into public visibility for its /prelaunch page even
    // before launch, which is how the home page's "Projects in
    // Prelaunch" section links work.
    const isCreatorOrAdmin =
      userId === project.creatorId ||
      userRole === "ADMIN" ||
      userRole === "SUPER_ADMIN";

    let isCollaborator = false;
    if (!isCreatorOrAdmin && userId) {
      const userEmail = session?.user?.email?.toLowerCase();
      const collab = await db.projectCollaborator.findFirst({
        where: {
          projectId: project.id,
          status: "ACCEPTED",
          OR: [
            { userId },
            ...(userEmail ? [{ email: { equals: userEmail, mode: "insensitive" as const } }] : []),
          ],
        },
        select: { id: true },
      });
      isCollaborator = !!collab;
    }

    if (
      (project.status === "DRAFT" || project.status === "SUBMITTED") &&
      !isCreatorOrAdmin &&
      !isCollaborator &&
      !project.prelaunchActive
    ) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Calculate days remaining
    let daysRemaining = 0;
    if (project.endDate) {
      const now = new Date();
      const end = new Date(project.endDate);
      daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // Always calculate live stats from pledges
    const liveStats = await getProjectStats(project.id, {
      status: project.status,
      goalAmount: project.goalAmount,
    });

    // Fetch creator rating aggregation
    const ratingAgg = await db.backerReview.aggregate({
      where: {
        creatorId: project.creator.id,
        isPublished: true,
        isHidden: false,
        overallRating: { not: null },
      },
      _avg: {
        overallRating: true,
        deliveryRating: true,
        qualityRating: true,
        communicationRating: true,
      },
      _count: { overallRating: true },
    });

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
      // Funding — always calculate live from pledges (never use stale stored fields)
      goalAmount: Number(project.goalAmount),
      currentAmount: liveStats.currentAmount,
      backerCount: liveStats.backerCount,
      // Duration
      durationType: project.durationType,
      durationDays: project.durationDays,
      endDate: project.endDate,
      launchDate: project.launchDate,
      launchedAt: project.launchedAt,
      daysRemaining,
      // Payment settings
      projectType: project.projectType,
      campaignType: project.campaignType,
      paymentProcessor: project.paymentProcessor,
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
        ratings: {
          avg: {
            overall: ratingAgg._avg.overallRating ? Number(ratingAgg._avg.overallRating.toFixed(1)) : null,
            delivery: ratingAgg._avg.deliveryRating ? Number(ratingAgg._avg.deliveryRating.toFixed(1)) : null,
            quality: ratingAgg._avg.qualityRating ? Number(ratingAgg._avg.qualityRating.toFixed(1)) : null,
            communication: ratingAgg._avg.communicationRating ? Number(ratingAgg._avg.communicationRating.toFixed(1)) : null,
          },
          count: ratingAgg._count.overallRating,
        },
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
      shippingCost: Record<string, number> | null;
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
      shippingCost: (r.shippingCost as Record<string, number>) || {},
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
    projectsVanityLogger.error({ err: String(error) }, "Get project by vanity URL error:");
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}
