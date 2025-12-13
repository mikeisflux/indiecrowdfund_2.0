import { NextResponse } from "next/server";
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
    // For backwards compatibility with pledges created before confirmationEmailSent feature
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [
      pledges,
      savedProjects,
      monthlyPledges,
    ] = await Promise.all([
      // Get user's pledges with full project and reward info
      // Include COMPLETED pledges and PENDING pledges that are "committed"
      // A pledge is considered committed if:
      // 1. It has a saved payment method, OR
      // 2. It's confirmed (confirmationEmailSent), OR
      // 3. It's old (>5 min) and has a SetupIntent (backwards compatibility)
      db.pledge.findMany({
        where: {
          userId,
          OR: [
            { status: "COMPLETED" },
            {
              // Pending with saved payment method
              status: "PENDING",
              stripePaymentMethodId: { not: null },
            },
            {
              // Pending with confirmation (checkout completed successfully)
              status: "PENDING",
              confirmationEmailSent: true,
            },
            {
              // Old pending pledges with SetupIntent (backwards compatibility)
              // Webhook might have failed to save payment method
              status: "PENDING",
              stripeSetupIntentId: { not: null },
              createdAt: { lt: fiveMinutesAgo },
            },
          ],
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

      // Get user's saved/followed projects
      db.projectFollower.findMany({
        where: {
          userId,
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
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Get monthly spending data (last 6 months)
      // Include both COMPLETED and committed PENDING pledges
      db.pledge.findMany({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
          },
          OR: [
            { status: "COMPLETED" },
            {
              status: "PENDING",
              stripePaymentMethodId: { not: null },
            },
            {
              status: "PENDING",
              confirmationEmailSent: true,
            },
            {
              status: "PENDING",
              stripeSetupIntentId: { not: null },
              createdAt: { lt: fiveMinutesAgo },
            },
          ],
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
    const totalPledged = pledges.reduce((sum, p) => sum + p.amount, 0);
    const projectsFunded = pledges.filter(
      (p) => p.project.status === "FUNDED" ||
             (p.project.currentAmount >= p.project.goalAmount)
    ).length;
    const successRate = totalBacked > 0 ? (projectsFunded / totalBacked) * 100 : 0;
    const avgContribution = totalBacked > 0 ? totalPledged / totalBacked : 0;

    // Count surveys
    const surveysCompleted = pledges.filter((p) => p.surveyCompleted).length;
    const pendingSurveys = pledges.filter(
      (p) => !p.surveyCompleted &&
             (p.project.status === "FUNDED" || p.project.currentAmount >= p.project.goalAmount)
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
        monthlySpendingMap.set(monthKey, (monthlySpendingMap.get(monthKey) || 0) + pledge.amount);
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

    // Process backed projects - deduplicate by project ID (keep the most recent pledge per project)
    const pledgesByProject = new Map<string, typeof pledges[0]>();
    pledges.forEach((pledge) => {
      const existing = pledgesByProject.get(pledge.project.id);
      if (!existing || new Date(pledge.createdAt) > new Date(existing.createdAt)) {
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

      return {
        id: pledge.project.id,
        title: pledge.project.title,
        slug: pledge.project.slug,
        imageUrl: pledge.project.imageUrl,
        creator: {
          name: pledge.project.creator.name || "Unknown Creator",
          avatar: pledge.project.creator.image,
        },
        status: pledge.project.status,
        goalAmount: pledge.project.goalAmount,
        currentAmount: pledge.project.currentAmount,
        daysRemaining,
        pledge: {
          id: pledge.id,
          amount: pledge.amount,
          reward: pledge.reward?.title || "No reward",
          pledgedAt: pledge.createdAt,
          status: pledge.status,
        },
        estimatedDelivery: pledge.reward?.estimatedDelivery || null,
        fulfillmentStatus: pledge.fulfillmentStatus,
        surveyCompleted: pledge.surveyCompleted,
        updates: pledge.project._count.updates,
        backerCount: pledge.project.backerCount,
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

        return {
          id: sp.project.id,
          title: sp.project.title,
          slug: sp.project.slug,
          imageUrl: sp.project.imageUrl,
          creator: {
            name: sp.project.creator.name || "Unknown Creator",
          },
          status: sp.project.status,
          goalAmount: sp.project.goalAmount,
          currentAmount: sp.project.currentAmount,
          daysRemaining,
          category: sp.project.category,
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
    console.error("Backer dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
