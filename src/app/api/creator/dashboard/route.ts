import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const days = parseInt(searchParams.get("days") || "30");

    // Get user's own projects
    const ownProjects = await db.project.findMany({
      where: {
        creatorId: session.user.id,
      },
      orderBy: [
        { status: "asc" }, // LIVE projects first
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        imageUrl: true,
        goalAmount: true,
        currentAmount: true,
        backerCount: true,
        endDate: true,
        launchDate: true,
        launchedAt: true,
        createdAt: true,
      },
    });

    // Get projects user is collaborating on
    const collaborations = await db.projectCollaborator.findMany({
      where: {
        userId: session.user.id,
        status: "ACCEPTED",
      },
      select: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            imageUrl: true,
            goalAmount: true,
            currentAmount: true,
            backerCount: true,
            endDate: true,
            launchDate: true,
            launchedAt: true,
            createdAt: true,
          },
        },
      },
    });

    // Combine own projects and collaborated projects (avoiding duplicates)
    const ownProjectIds = new Set(ownProjects.map(p => p.id));
    type ProjectType = typeof ownProjects[number];
    const collaboratedProjects = collaborations
      .map((c: { project: ProjectType }) => c.project)
      .filter((p: ProjectType) => !ownProjectIds.has(p.id));

    const projects = [...ownProjects, ...collaboratedProjects].sort((a, b) => {
      // LIVE projects first, then by createdAt desc
      if (a.status !== b.status) {
        return a.status === "LIVE" ? -1 : b.status === "LIVE" ? 1 : 0;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // If no projects, return empty dashboard
    if (projects.length === 0) {
      return NextResponse.json({
        projects: [],
        selectedProject: null,
        stats: null,
        fundingData: [],
        recentBackers: [],
        rewardStats: [],
        referrers: [],
      });
    }

    // Select project - use provided projectId or first active project
    const selectedProjectId = projectId ||
      projects.find(p => p.status === "LIVE")?.id ||
      projects[0].id;

    const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Fetch all dashboard data in parallel
    const [
      todayPledges,
      todayBackers,
      todayViews,
      yesterdayPledges,
      totalViews,
      weeklyViews,
      lastWeekViews,
      recentBackers,
      rewardStats,
      dailyFunding,
      referrerData,
    ] = await Promise.all([
      // Today's pledges amount
      db.pledge.aggregate({
        where: {
          projectId: selectedProjectId,
          status: "COMPLETED",
          createdAt: { gte: todayStart },
        },
        _sum: { amount: true },
      }),

      // Today's backer count
      db.pledge.count({
        where: {
          projectId: selectedProjectId,
          status: "COMPLETED",
          createdAt: { gte: todayStart },
        },
      }),

      // Today's views
      db.userBehavior.count({
        where: {
          projectId: selectedProjectId,
          eventType: "PROJECT_VIEW",
          timestamp: { gte: todayStart },
        },
      }),

      // Yesterday's pledges (for comparison)
      db.pledge.aggregate({
        where: {
          projectId: selectedProjectId,
          status: "COMPLETED",
          createdAt: {
            gte: new Date(todayStart.getTime() - 24 * 60 * 60 * 1000),
            lt: todayStart,
          },
        },
        _sum: { amount: true },
      }),

      // Total views in period
      db.userBehavior.count({
        where: {
          projectId: selectedProjectId,
          eventType: "PROJECT_VIEW",
          timestamp: { gte: startDate },
        },
      }),

      // This week's views
      db.userBehavior.count({
        where: {
          projectId: selectedProjectId,
          eventType: "PROJECT_VIEW",
          timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),

      // Last week's views (for comparison)
      db.userBehavior.count({
        where: {
          projectId: selectedProjectId,
          eventType: "PROJECT_VIEW",
          timestamp: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Recent backers with user info
      db.pledge.findMany({
        where: {
          projectId: selectedProjectId,
          status: "COMPLETED",
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: {
            select: {
              name: true,
              image: true,
            },
          },
          reward: {
            select: {
              title: true,
            },
          },
        },
      }),

      // Reward statistics
      db.reward.findMany({
        where: {
          projectId: selectedProjectId,
          type: "TIER",
        },
        include: {
          _count: {
            select: {
              pledges: {
                where: { status: "COMPLETED" },
              },
            },
          },
          pledges: {
            where: { status: "COMPLETED" },
            select: { amount: true },
          },
        },
        orderBy: { amount: "asc" },
      }),

      // Daily funding data for chart
      db.pledge.findMany({
        where: {
          projectId: selectedProjectId,
          status: "COMPLETED",
          createdAt: { gte: startDate },
        },
        select: {
          amount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),

      // Referrer data
      db.referralTracker.findMany({
        where: {
          projectId: selectedProjectId,
          date: { gte: startDate },
        },
        orderBy: { pledgeAmount: "desc" },
      }),
    ]);

    // Calculate days remaining
    let daysRemaining = 0;
    if (selectedProject.endDate) {
      daysRemaining = Math.max(0, Math.ceil(
        (new Date(selectedProject.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ));
    }

    // Calculate weekly growth
    const weeklyGrowth = lastWeekViews > 0
      ? ((weeklyViews - lastWeekViews) / lastWeekViews) * 100
      : weeklyViews > 0 ? 100 : 0;

    // Calculate conversion rate
    const conversionRate = totalViews > 0
      ? (selectedProject.backerCount / totalViews) * 100
      : 0;

    // Calculate average pledge
    const avgPledge = selectedProject.backerCount > 0
      ? selectedProject.currentAmount / selectedProject.backerCount
      : 0;

    // Calculate today vs yesterday change
    const todayAmount = todayPledges._sum.amount || 0;
    const yesterdayAmount = yesterdayPledges._sum.amount || 0;
    const dailyChange = yesterdayAmount > 0
      ? ((todayAmount - yesterdayAmount) / yesterdayAmount) * 100
      : todayAmount > 0 ? 100 : 0;

    // Process daily funding into chart format
    const fundingByDate = new Map<string, { amount: number; cumulative: number }>();
    let cumulative = 0;

    // Initialize all dates in range
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      fundingByDate.set(dateStr, { amount: 0, cumulative: 0 });
    }

    // Fill in actual pledge data
    dailyFunding.forEach((pledge) => {
      const dateStr = pledge.createdAt.toISOString().split("T")[0];
      const existing = fundingByDate.get(dateStr);
      if (existing) {
        existing.amount += pledge.amount;
      }
    });

    // Calculate cumulative
    const fundingData: { date: string; amount: number; cumulative: number }[] = [];
    Array.from(fundingByDate.entries()).forEach(([date, data]) => {
      cumulative += data.amount;
      fundingData.push({
        date,
        amount: Math.round(data.amount * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100,
      });
    });

    // Process reward stats
    const processedRewardStats = rewardStats.map((reward) => {
      const totalPledged = reward.pledges.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
      const remaining = reward.quantityAvailable !== null
        ? reward.quantityAvailable - reward.quantityClaimed
        : null;

      return {
        id: reward.id,
        title: reward.title,
        amount: reward.amount,
        backers: reward._count.pledges,
        total: Math.round(totalPledged * 100) / 100,
        remaining,
      };
    });

    // Process referrer data
    const referrerMap = new Map<string, { visits: number; pledges: number; amount: number }>();
    referrerData.forEach((r) => {
      const existing = referrerMap.get(r.referrer) || { visits: 0, pledges: 0, amount: 0 };
      existing.visits += r.visits;
      existing.pledges += r.pledges;
      existing.amount += r.pledgeAmount;
      referrerMap.set(r.referrer, existing);
    });

    const totalReferrerVisits = Array.from(referrerMap.values()).reduce((sum, r) => sum + r.visits, 0);
    const processedReferrers = Array.from(referrerMap.entries())
      .map(([source, data]) => ({
        source,
        visits: data.visits,
        pledges: data.pledges,
        amount: Math.round(data.amount * 100) / 100,
        percentage: totalReferrerVisits > 0 ? Math.round((data.visits / totalReferrerVisits) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Process recent backers
    const processedBackers = recentBackers.map((pledge) => {
      const now = Date.now();
      const pledgeTime = pledge.createdAt.getTime();
      const diffMs = now - pledgeTime;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let timeAgo: string;
      if (diffMins < 1) {
        timeAgo = "just now";
      } else if (diffMins < 60) {
        timeAgo = `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      } else {
        timeAgo = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
      }

      return {
        name: pledge.user.name || "Anonymous",
        image: pledge.user.image,
        amount: pledge.amount,
        reward: pledge.reward?.title || "No Reward",
        time: timeAgo,
      };
    });

    return NextResponse.json({
      projects: projects.map(p => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        imageUrl: p.imageUrl,
      })),
      selectedProject: {
        id: selectedProject.id,
        title: selectedProject.title,
        slug: selectedProject.slug,
        status: selectedProject.status,
        imageUrl: selectedProject.imageUrl,
        goalAmount: selectedProject.goalAmount,
        currentAmount: selectedProject.currentAmount,
        backerCount: selectedProject.backerCount,
        daysRemaining,
        endDate: selectedProject.endDate,
        launchedAt: selectedProject.launchedAt,
      },
      stats: {
        todayPledges: Math.round(todayAmount * 100) / 100,
        todayBackers,
        todayViews,
        weeklyGrowth: Math.round(weeklyGrowth * 10) / 10,
        conversionRate: Math.round(conversionRate * 100) / 100,
        avgPledge: Math.round(avgPledge * 100) / 100,
        dailyChange: Math.round(dailyChange * 10) / 10,
      },
      fundingData,
      recentBackers: processedBackers,
      rewardStats: processedRewardStats,
      referrers: processedReferrers,
    });
  } catch (error) {
    console.error("Creator dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
