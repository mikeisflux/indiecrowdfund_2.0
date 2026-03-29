import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const backerDashboardLogger = logger.child({ module: "backer-dashboard" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch user info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Fetch all backer data in parallel
    const [
      pledges,
      savedProjects,
      monthlyPledges,
    ] = await Promise.all([
      // Get user's COMPLETED pledges only
      // Pending pledges are not counted in backer totals
      db.pledge.findMany({
        where: {
          userId,
          deletedAt: null,
          status: "COMPLETED",
        },
        include: {
          project: {
            select: {
              id: true,
              title: true,
              slug: true,
              imageUrl: true,
              status: true,
              goalAmount: true,
              currentAmount: true,
              backerCount: true,
              endDate: true,
              category: true,
              creator: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  vanityUrl: true,
                },
              },
              _count: {
                select: {
                  updates: {
                    where: { status: "PUBLISHED" },
                  },
                },
              },
            },
          },
          reward: {
            select: {
              id: true,
              title: true,
              amount: true,
              estimatedDelivery: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Get user's saved/followed projects (exclude deleted projects)
      db.projectFollower.findMany({
        where: {
          userId,
          project: {
            deletedAt: null,
          },
        },
        include: {
          project: {
            select: {
              id: true,
              title: true,
              slug: true,
              imageUrl: true,
              status: true,
              goalAmount: true,
              currentAmount: true,
              backerCount: true,
              endDate: true,
              category: true,
              creator: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  vanityUrl: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Get monthly spending data (last 6 months) - COMPLETED only
      db.pledge.findMany({
        where: {
          userId,
          deletedAt: null,
          status: "COMPLETED",
          createdAt: {
            gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          amount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Calculate stats
    const totalBacked = pledges.length;
    const totalPledged = pledges.reduce((sum, p) => sum + Number(p.amount), 0);
    const projectsFunded = pledges.filter(
      (p) => p.project.status === "FUNDED" ||
             (Number(p.project.currentAmount) >= Number(p.project.goalAmount))
    ).length;
    const successRate = totalBacked > 0 ? (projectsFunded / totalBacked) * 100 : 0;
    const avgContribution = totalBacked > 0 ? totalPledged / totalBacked : 0;

    // Count surveys - only count if a survey actually exists for the project
    const projectIds = Array.from(new Set(pledges.map((p) => p.projectId)));
    const existingSurveys = await db.survey.findMany({
      where: {
        projectId: { in: projectIds },
        status: { in: ["SENT", "LOCKED"] }, // Only surveys that have been sent to backers
      },
      select: { projectId: true },
    });
    const projectsWithSurveys = new Set(existingSurveys.map((s) => s.projectId));

    const surveysCompleted = pledges.filter(
      (p) => p.surveyCompleted && projectsWithSurveys.has(p.projectId)
    ).length;
    const pendingSurveys = pledges.filter(
      (p) => !p.surveyCompleted && projectsWithSurveys.has(p.projectId)
    ).length;

    // Count rewards by fulfillment status
    const rewardsDelivered = pledges.filter((p) => p.fulfillmentStatus === "DELIVERED").length;
    const rewardsPending = pledges.filter((p) => p.fulfillmentStatus !== "DELIVERED").length;

    // Process monthly spending
    const monthlySpendingMap = new Map<string, number>();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      monthlySpendingMap.set(monthKey, 0);
    }

    // Fill in actual spending
    monthlyPledges.forEach((pledge) => {
      const date = new Date(pledge.createdAt);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (monthlySpendingMap.has(monthKey)) {
        monthlySpendingMap.set(monthKey, (monthlySpendingMap.get(monthKey) || 0) + Number(pledge.amount));
      }
    });

    // Convert to array format
    const monthlySpending = Array.from(monthlySpendingMap.entries()).map(([key, amount]) => {
      const [, month] = key.split("-");
      return {
        month: months[parseInt(month)],
        amount: Math.round(amount * 100) / 100,
      };
    });

    // Process backed projects - deduplicate by project ID
    // Prefer COMPLETED over PENDING, then keep the most recent
    const pledgesByProject = new Map<string, typeof pledges[0]>();
    pledges.forEach((pledge) => {
      const existing = pledgesByProject.get(pledge.project.id);
      if (!existing ||
          (pledge.status === "COMPLETED" && existing.status !== "COMPLETED") ||
          (pledge.status === existing.status && new Date(pledge.createdAt) > new Date(existing.createdAt))) {
        pledgesByProject.set(pledge.project.id, pledge);
      }
    });

    const backedProjects = Array.from(pledgesByProject.values()).map((pledge) => {
      let daysRemaining = 0;
      if (pledge.project.endDate) {
        daysRemaining = Math.max(0, Math.ceil(
          (new Date(pledge.project.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        ));
      }

      // Build project URL with vanity URL if available
      const projectUrl = pledge.project.creator.vanityUrl
        ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
        : `/projects/${pledge.project.slug}`;

      return {
        id: pledge.project.id,
        title: pledge.project.title,
        slug: pledge.project.slug,
        imageUrl: pledge.project.imageUrl,
        creatorId: pledge.project.creator.id,
        creator: {
          name: pledge.project.creator.name || "Unknown Creator",
          avatar: pledge.project.creator.image,
        },
        status: pledge.project.status,
        goalAmount: Number(pledge.project.goalAmount),
        currentAmount: Number(pledge.project.currentAmount),
        daysRemaining,
        endDate: pledge.project.endDate?.toISOString() || null,
        pledge: {
          id: pledge.id,
          amount: Number(pledge.amount),
          reward: pledge.reward?.title || "No reward",
          pledgedAt: pledge.createdAt,
          status: pledge.status,
          backerNumber: pledge.backerNumber,
        },
        estimatedDelivery: pledge.reward?.estimatedDelivery || null,
        fulfillmentStatus: pledge.fulfillmentStatus,
        surveyCompleted: pledge.surveyCompleted,
        hasSurvey: projectsWithSurveys.has(pledge.project.id),
        updates: pledge.project._count.updates,
        backerCount: pledge.project.backerCount,
        projectUrl,
      };
    });

    // Process saved projects (exclude already backed ones)
    const backedProjectIds = new Set(pledges.map((p) => p.project.id));
    const processedSavedProjects = savedProjects
      .filter((sp: typeof savedProjects[number]) => !backedProjectIds.has(sp.project.id))
      .map((sp: typeof savedProjects[number]) => {
        let daysRemaining = 0;
        if (sp.project.endDate) {
          daysRemaining = Math.max(0, Math.ceil(
            (new Date(sp.project.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          ));
        }

        // Build project URL with vanity URL if available
        const projectUrl = sp.project.creator.vanityUrl
          ? `/projects/${sp.project.creator.vanityUrl}/${sp.project.slug}`
          : `/projects/${sp.project.slug}`;

        return {
          id: sp.project.id,
          title: sp.project.title,
          slug: sp.project.slug,
          imageUrl: sp.project.imageUrl,
          creator: {
            name: sp.project.creator.name || "Unknown Creator",
          },
          status: sp.project.status,
          goalAmount: Number(sp.project.goalAmount),
          currentAmount: Number(sp.project.currentAmount),
          daysRemaining,
          endDate: sp.project.endDate?.toISOString() || null,
          category: sp.project.category,
          projectUrl,
        };
      });

    return NextResponse.json({
      user: {
        name: user?.name || null,
      },
      backedProjects,
      savedProjects: processedSavedProjects,
      stats: {
        totalBacked,
        totalPledged: Math.round(totalPledged * 100) / 100,
        projectsFunded,
        surveysCompleted,
        pendingSurveys,
        avgContribution: Math.round(avgContribution * 100) / 100,
        successRate: Math.round(successRate * 10) / 10,
      },
      analytics: {
        totalInvested: Math.round(totalPledged * 100) / 100,
        projectsSucceeded: projectsFunded,
        projectsInProgress: totalBacked - projectsFunded,
        rewardsDelivered,
        rewardsPending,
        monthlySpending,
      },
    });
  } catch (error) {
    backerDashboardLogger.error({ err: String(error) }, "Backer dashboard error:");
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
