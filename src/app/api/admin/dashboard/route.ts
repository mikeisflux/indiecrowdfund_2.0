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

      // Revenue stats - from COMPLETED pledges only
      totalPledges,
      totalRevenueAgg,
      pledgesThisMonth,
      pledgesPrevMonth,

      // Recent activity
      recentUsers,
      pendingReviews,

      // Reports/Moderation
      pendingReports,
    ] = await Promise.all([
      // Users (exclude deleted)
      db.user.count({ where: { deletedAt: null } }),
      db.user.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
      db.user.count({ where: { deletedAt: null, createdAt: { gte: previousThirtyDays, lt: thirtyDaysAgo } } }),

      // Projects (exclude deleted)
      db.project.count({ where: { deletedAt: null } }),
      db.project.count({ where: { deletedAt: null, status: "LIVE" } }),
      db.project.count({ where: { deletedAt: null, status: "SUBMITTED" } }),
      db.project.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),

      // Pledges - count COMPLETED only
      db.pledge.count({
        where: {
          deletedAt: null,
          status: "COMPLETED",
          project: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
        },
      }),
      // Total revenue from COMPLETED pledges
      db.pledge.aggregate({
        where: {
          deletedAt: null,
          status: "COMPLETED",
          project: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
        },
        _sum: { amount: true },
      }),
      // Revenue this month - COMPLETED pledges only
      db.pledge.aggregate({
        where: {
          deletedAt: null,
          status: "COMPLETED",
          createdAt: { gte: thirtyDaysAgo },
          project: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
        },
        _sum: { amount: true },
        _count: true
      }),
      // Revenue previous month - COMPLETED pledges only
      db.pledge.aggregate({
        where: {
          deletedAt: null,
          status: "COMPLETED",
          createdAt: { gte: previousThirtyDays, lt: thirtyDaysAgo },
          project: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
        },
        _sum: { amount: true },
        _count: true
      }),

      // Recent activity (exclude deleted)
      db.user.findMany({
        where: { deletedAt: null },
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
        where: { deletedAt: null, status: { in: ["SUBMITTED", "APPROVED"] } },
        take: 10,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          status: true,
          category: true,
          goalAmount: true,
          currentAmount: true,
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

    const revenueThisMonth = Number(pledgesThisMonth._sum.amount || 0);
    const revenuePrevMonth = Number(pledgesPrevMonth._sum.amount || 0);
    const revenueGrowth = revenuePrevMonth > 0
      ? ((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth * 100).toFixed(1)
      : revenueThisMonth > 0 ? 100 : 0;

    // Get project status breakdown (exclude deleted)
    const projectsByStatus = await db.project.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: true
    });

    const statusBreakdown = projectsByStatus.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    // Get pledges by day for chart (last 7 days, exclude deleted)
    const pledgesByDay = await db.pledge.groupBy({
      by: ["createdAt"],
      where: {
        deletedAt: null,
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
        completedPledgeCount: totalPledges,
        totalRevenue: Number(totalRevenueAgg._sum.amount || 0),
        revenueThisMonth,
        revenueGrowth: Number(revenueGrowth),
        pendingReports,
      },
      projectsByStatus: statusBreakdown,
      // Projects requiring action (SUBMITTED or APPROVED needing launch)
      recentActivity: {
        projects: pendingReviews.map(p => ({
          id: p.id,
          type: "project",
          title: p.title,
          status: p.status,
          category: p.category,
          goalAmount: Number(p.goalAmount),
          currentAmount: Number(p.currentAmount),
          createdAt: p.createdAt,
          creator: {
            name: p.creator.name,
            email: p.creator.email
          }
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
