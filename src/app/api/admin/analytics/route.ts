import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminAnalyticsLogger = logger.child({ module: "admin-analytics" });
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

// GET - Get analytics data
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "30d";
    const tab = searchParams.get("tab") || "overview";

    // Calculate date ranges
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;

    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    }

    if (tab === "overview") {
      // Get overview metrics
      const [
        currentVisits,
        previousVisits,
        currentPledges,
        previousPledges,
        currentUsers,
        previousUsers,
        projectsByCategory,
      ] = await Promise.all([
        // Page views current period
        db.userBehavior.count({
          where: {
            eventType: "PAGE_VIEW",
            timestamp: { gte: startDate }
          }
        }),
        // Page views previous period
        db.userBehavior.count({
          where: {
            eventType: "PAGE_VIEW",
            timestamp: { gte: previousStartDate, lt: startDate }
          }
        }),
        // Pledges current period - include COMPLETED + committed PENDING
        db.pledge.aggregate({
          where: {
            deletedAt: null,
            createdAt: { gte: startDate },
            project: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
            OR: [
              { status: "COMPLETED" },
              { status: "PENDING", confirmationEmailSent: true },
            ],
          },
          _sum: { amount: true },
          _count: true
        }),
        // Pledges previous period - include COMPLETED + committed PENDING
        db.pledge.aggregate({
          where: {
            deletedAt: null,
            createdAt: { gte: previousStartDate, lt: startDate },
            project: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
            OR: [
              { status: "COMPLETED" },
              { status: "PENDING", confirmationEmailSent: true },
            ],
          },
          _sum: { amount: true },
          _count: true
        }),
        // New users current period (exclude deleted)
        db.user.count({
          where: { deletedAt: null, createdAt: { gte: startDate } }
        }),
        // New users previous period (exclude deleted)
        db.user.count({
          where: { deletedAt: null, createdAt: { gte: previousStartDate, lt: startDate } }
        }),
        // Projects by category (exclude deleted)
        db.project.groupBy({
          by: ["category"],
          where: { deletedAt: null, status: { in: ["LIVE", "FUNDED", "FAILED"] } },
          _count: true,
          _sum: { currentAmount: true }
        }),
      ]);

      // Calculate growth percentages
      const visitGrowth = previousVisits > 0
        ? ((currentVisits - previousVisits) / previousVisits * 100)
        : currentVisits > 0 ? 100 : 0;

      const revenueGrowth = Number(previousPledges._sum.amount || 0) > 0
        ? ((Number(currentPledges._sum.amount || 0) - Number(previousPledges._sum.amount || 0)) / Number(previousPledges._sum.amount || 1) * 100)
        : Number(currentPledges._sum.amount || 0) > 0 ? 100 : 0;

      const userGrowth = previousUsers > 0
        ? ((currentUsers - previousUsers) / previousUsers * 100)
        : currentUsers > 0 ? 100 : 0;

      return NextResponse.json({
        overview: {
          visits: {
            current: currentVisits,
            previous: previousVisits,
            growth: visitGrowth.toFixed(1)
          },
          revenue: {
            current: Number(currentPledges._sum.amount) || 0,
            previous: Number(previousPledges._sum.amount) || 0,
            growth: revenueGrowth.toFixed(1),
            count: currentPledges._count
          },
          users: {
            current: currentUsers,
            previous: previousUsers,
            growth: userGrowth.toFixed(1)
          },
          conversionRate: currentVisits > 0
            ? ((currentPledges._count / currentVisits) * 100).toFixed(2)
            : "0.00"
        },
        projectsByCategory: projectsByCategory.map(p => ({
          category: p.category,
          count: p._count,
          totalFunding: Number(p._sum.currentAmount) || 0
        }))
      });
    }

    if (tab === "revenue") {
      // Get revenue breakdown
      const [completedPledges, topProjects, completedStats, committedPendingStats] = await Promise.all([
        // Get committed pledges in the period for grouping by day
        db.pledge.findMany({
          where: {
            deletedAt: null,
            createdAt: { gte: startDate },
            project: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
            OR: [
              { status: "COMPLETED" },
              { status: "PENDING", confirmationEmailSent: true },
            ],
          },
          select: {
            amount: true,
            createdAt: true
          },
          orderBy: { createdAt: "asc" }
        }),
        // Top projects by revenue
        db.project.findMany({
          where: {
            status: { in: ["LIVE", "FUNDED", "FAILED"] },
            deletedAt: null,
          },
          orderBy: { currentAmount: "desc" },
          take: 10,
          select: {
            id: true,
            title: true,
            currentAmount: true,
            goalAmount: true,
            backerCount: true
          }
        }),
        // Completed pledges aggregate
        db.pledge.aggregate({
          where: {
            deletedAt: null,
            status: "COMPLETED",
            project: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
          },
          _count: true,
          _sum: { amount: true }
        }),
        // Committed pending pledges aggregate
        db.pledge.aggregate({
          where: {
            deletedAt: null,
            status: "PENDING",
            confirmationEmailSent: true,
            project: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
          },
          _count: true,
          _sum: { amount: true }
        })
      ]);

      // Group pledges by day manually
      const pledgesByDay = new Map<string, { total: number; count: number }>();
      completedPledges.forEach(pledge => {
        const dateKey = pledge.createdAt.toISOString().split('T')[0];
        const existing = pledgesByDay.get(dateKey) || { total: 0, count: 0 };
        existing.total += Number(pledge.amount);
        existing.count += 1;
        pledgesByDay.set(dateKey, existing);
      });

      const byDay = Array.from(pledgesByDay.entries())
        .map(([date, data]) => ({
          date,
          total: data.total,
          count: data.count
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return NextResponse.json({
        revenue: {
          byDay,
          topProjects,
          byStatus: [
            {
              status: "COMPLETED",
              count: completedStats._count,
              total: Number(completedStats._sum.amount) || 0
            },
            {
              status: "PENDING",
              count: committedPendingStats._count,
              total: Number(committedPendingStats._sum.amount) || 0
            }
          ]
        }
      });
    }

    if (tab === "traffic") {
      // Get traffic data
      const [pageViews, topReferrers, deviceBreakdown] = await Promise.all([
        // Page views by path
        db.userBehavior.groupBy({
          by: ["path"],
          where: {
            eventType: "PAGE_VIEW",
            timestamp: { gte: startDate }
          },
          _count: true,
          orderBy: { _count: { path: "desc" } },
          take: 20
        }),
        // Top referrers
        db.userBehavior.groupBy({
          by: ["referrer"],
          where: {
            eventType: "PAGE_VIEW",
            timestamp: { gte: startDate },
            referrer: { not: null }
          },
          _count: true,
          orderBy: { _count: { referrer: "desc" } },
          take: 10
        }),
        // Device breakdown (simplified - based on user agent patterns)
        db.userBehavior.groupBy({
          by: ["userAgent"],
          where: {
            eventType: "PAGE_VIEW",
            timestamp: { gte: startDate }
          },
          _count: true
        })
      ]);

      // Process device breakdown
      let mobile = 0;
      let desktop = 0;
      let tablet = 0;

      deviceBreakdown.forEach(d => {
        const ua = (d.userAgent || "").toLowerCase();
        if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) {
          mobile += d._count;
        } else if (ua.includes("ipad") || ua.includes("tablet")) {
          tablet += d._count;
        } else {
          desktop += d._count;
        }
      });

      return NextResponse.json({
        traffic: {
          topPages: pageViews.map(p => ({
            path: p.path,
            views: p._count
          })),
          topReferrers: topReferrers.map(r => ({
            referrer: r.referrer || "Direct",
            visits: r._count
          })),
          devices: {
            mobile,
            desktop,
            tablet
          }
        }
      });
    }

    if (tab === "projects") {
      // Get project analytics
      const [projectStats, recentProjects, fundingProgress] = await Promise.all([
        // Projects by status
        db.project.groupBy({
          by: ["status"],
          where: { deletedAt: null },
          _count: true
        }),
        // Recent projects with details
        db.project.findMany({
          where: { deletedAt: null, createdAt: { gte: startDate } },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            title: true,
            status: true,
            category: true,
            goalAmount: true,
            currentAmount: true,
            backerCount: true,
            createdAt: true
          }
        }),
        // Funding progress distribution
        db.project.findMany({
          where: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
          select: {
            goalAmount: true,
            currentAmount: true
          }
        })
      ]);

      // Calculate funding distribution
      const fundingDistribution = {
        "0-25%": 0,
        "25-50%": 0,
        "50-75%": 0,
        "75-100%": 0,
        "100%+": 0
      };

      fundingProgress.forEach(p => {
        const goalAmount = Number(p.goalAmount);
        const progress = goalAmount > 0 ? (Number(p.currentAmount) / goalAmount) * 100 : 0;
        if (progress >= 100) fundingDistribution["100%+"]++;
        else if (progress >= 75) fundingDistribution["75-100%"]++;
        else if (progress >= 50) fundingDistribution["50-75%"]++;
        else if (progress >= 25) fundingDistribution["25-50%"]++;
        else fundingDistribution["0-25%"]++;
      });

      return NextResponse.json({
        projects: {
          byStatus: projectStats.map(p => ({
            status: p.status,
            count: p._count
          })),
          recent: recentProjects,
          fundingDistribution
        }
      });
    }

    if (tab === "geography") {
      // Get geographic data from multiple sources
      const [countryData, cityData, userLocations, backerLocations] = await Promise.all([
        // By country from tracking data
        db.userBehavior.groupBy({
          by: ["country"],
          where: {
            timestamp: { gte: startDate },
            country: { not: null }
          },
          _count: true,
          orderBy: { _count: { country: "desc" } },
          take: 20
        }),
        // Top cities from project locations
        db.project.groupBy({
          by: ["location"],
          where: {
            deletedAt: null,
            location: { not: null },
            NOT: { location: "" }
          },
          _count: true,
          orderBy: { _count: { location: "desc" } },
          take: 10
        }),
        // User profile locations
        db.user.groupBy({
          by: ["location"],
          where: {
            deletedAt: null,
            location: { not: null },
            NOT: { location: "" }
          },
          _count: true,
          orderBy: { _count: { location: "desc" } },
          take: 15
        }),
        // Backer locations (users who have made pledges)
        db.user.findMany({
          where: {
            deletedAt: null,
            location: { not: null },
            NOT: { location: "" },
            pledges: {
              some: {
                status: "COMPLETED",
                deletedAt: null
              }
            }
          },
          select: { location: true },
        })
      ]);

      // Aggregate backer locations
      const backerLocationMap = new Map<string, number>();
      backerLocations.forEach(u => {
        if (u.location) {
          const loc = u.location.trim();
          backerLocationMap.set(loc, (backerLocationMap.get(loc) || 0) + 1);
        }
      });
      const backerLocationsSorted = Array.from(backerLocationMap.entries())
        .map(([location, count]) => ({ location, backerCount: count }))
        .sort((a, b) => b.backerCount - a.backerCount)
        .slice(0, 10);

      return NextResponse.json({
        geography: {
          countries: countryData.map(c => ({
            country: c.country || "Unknown",
            visits: c._count
          })),
          cities: cityData.map(c => ({
            location: c.location || "Unknown",
            projectCount: c._count
          })),
          userLocations: userLocations.map(u => ({
            location: u.location || "Unknown",
            userCount: u._count
          })),
          backerLocations: backerLocationsSorted
        }
      });
    }

    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  } catch (error) {
    adminAnalyticsLogger.error({ err: String(error) }, "Error fetching analytics:");
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
