import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// GET - Get dashboard statistics
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousThirtyDays = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Get all stats in parallel
    const [
      // User stats
      totalUsers,
      newUsersThisMonth,
      newUsersPrevMonth,

      // Project stats
      totalProjects,
      liveProjects,
      pendingProjects,
      projectsThisMonth,

      // Revenue stats (from pledges)
      totalPledges,
      completedPledges,
      pledgesThisMonth,
      pledgesPrevMonth,

      // Recent activity
      recentProjects,
      recentUsers,
      pendingReviews,

      // Reports/Moderation
      pendingReports,
    ] = await Promise.all([
      // Users
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      db.user.count({ where: { createdAt: { gte: previousThirtyDays, lt: thirtyDaysAgo } } }),

      // Projects
      db.project.count(),
      db.project.count({ where: { status: "LIVE" } }),
      db.project.count({ where: { status: "SUBMITTED" } }),
      db.project.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),

      // Pledges
      db.pledge.count(),
      db.pledge.aggregate({
        where: { status: "COMPLETED" },
        _sum: { amount: true },
        _count: true
      }),
      db.pledge.aggregate({
        where: {
          status: "COMPLETED",
          createdAt: { gte: thirtyDaysAgo }
        },
        _sum: { amount: true },
        _count: true
      }),
      db.pledge.aggregate({
        where: {
          status: "COMPLETED",
          createdAt: { gte: previousThirtyDays, lt: thirtyDaysAgo }
        },
        _sum: { amount: true },
        _count: true
      }),

      // Recent activity
      db.project.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          creator: {
            select: { name: true, email: true }
          }
        }
      }),
      db.user.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true
        }
      }),
      db.project.findMany({
        where: { status: "SUBMITTED" },
        take: 10,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          createdAt: true,
          creator: {
            select: { name: true, email: true }
          }
        }
      }),

      // Reports
      db.report.count({ where: { status: "PENDING" } }).catch(() => 0),
    ]);

    // Calculate growth percentages
    const userGrowth = newUsersPrevMonth > 0
      ? ((newUsersThisMonth - newUsersPrevMonth) / newUsersPrevMonth * 100).toFixed(1)
      : newUsersThisMonth > 0 ? 100 : 0;

    const revenueThisMonth = pledgesThisMonth._sum.amount || 0;
    const revenuePrevMonth = pledgesPrevMonth._sum.amount || 0;
    const revenueGrowth = revenuePrevMonth > 0
      ? ((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth * 100).toFixed(1)
      : revenueThisMonth > 0 ? 100 : 0;

    // Get project status breakdown
    const projectsByStatus = await db.project.groupBy({
      by: ["status"],
      _count: true
    });

    const statusBreakdown = projectsByStatus.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    // Get pledges by day for chart (last 7 days)
    const pledgesByDay = await db.pledge.groupBy({
      by: ["createdAt"],
      where: {
        createdAt: { gte: sevenDaysAgo },
        status: "COMPLETED"
      },
      _sum: { amount: true },
      _count: true
    });

    return NextResponse.json({
      stats: {
        totalUsers,
        newUsersThisMonth,
        userGrowth: Number(userGrowth),
        totalProjects,
        liveProjects,
        pendingProjects,
        projectsThisMonth,
        totalPledges,
        completedPledgeCount: completedPledges._count,
        totalRevenue: completedPledges._sum.amount || 0,
        revenueThisMonth,
        revenueGrowth: Number(revenueGrowth),
        pendingReports,
      },
      projectsByStatus: statusBreakdown,
      recentActivity: {
        projects: recentProjects.map(p => ({
          id: p.id,
          type: "project",
          title: `New project: ${p.title}`,
          user: p.creator.name || p.creator.email,
          status: p.status,
          timestamp: p.createdAt
        })),
        users: recentUsers.map(u => ({
          id: u.id,
          type: "user",
          title: `New user: ${u.name || u.email}`,
          timestamp: u.createdAt
        }))
      },
      pendingReviews,
      pledgesByDay
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    );
  }
}
