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

    // Transform to the expected format
    const formattedProject = {
      id: project.id,
      title: project.title,
      subtitle: project.subtitle || "",
      slug: project.slug,
      category: project.category,
      subcategory: project.subcategory || "",
      location: project.location || "",
      imageUrl: project.imageUrl || "/placeholder-1.jpg",
      videoUrl: project.videoUrl || "",
      isProjectWeLove: false, // This could be a field in the future
      description: project.description,
      risks: project.risks,
      goalAmount: project.goalAmount,
      currentAmount: project.currentAmount,
      backerCount: project.backerCount,
      daysRemaining,
      endDate: project.endDate,
      launchedAt: project.launchedAt,
      creator: {
        id: project.creator.id,
        name: project.creator.name || "Creator",
        image: project.creator.image || "",
        bio: project.creator.bio || "",
        location: project.creator.location || "",
        projectsCreated: project.creator._count.createdProjects,
        projectsBacked: project.creator._count.pledges,
      },
      usesAI: project.usesAI,
      faqs: (project.faqs as { question: string; answer: string }[]) || [],
      updates: project.updates.map((u: { id: string; title: string; content: string; publishedAt: Date | null; createdAt: Date }) => ({
        id: u.id,
        title: u.title,
        content: u.content,
        createdAt: u.publishedAt || u.createdAt,
      })),
      comments: project._count.comments,
    };

    // Transform rewards
    interface RewardItem {
      id: string;
      title: string;
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
      shippingLocation: r.shippingCountries.length > 0 ? r.shippingCountries.join(", ") : "Worldwide",
      shippingCost: r.shippingCost,
      quantityAvailable: r.quantityAvailable,
      quantityClaimed: r.quantityClaimed,
      imageUrl: r.imageUrl || "",
      items: r.items.map((i: RewardItem) => ({
        id: i.id,
        title: i.title,
        quantity: 1, // Default quantity per reward
      })),
      isEnded: r.isEnded,
      endedAt: r.endedAt,
    }));

    // Separate tiers and addons
    const tiers = formattedRewards.filter((r) => r.type === "TIER");
    const addons = formattedRewards.filter((r) => r.type === "ADDON");

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
