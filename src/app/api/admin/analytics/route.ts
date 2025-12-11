import { NextRequest, NextResponse } from "next/server";
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
        projectsByCategory
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
        // Pledges current period
        db.pledge.aggregate({
          where: {
            status: "COMPLETED",
            createdAt: { gte: startDate }
          },
          _sum: { amount: true },
          _count: true
        }),
        // Pledges previous period
        db.pledge.aggregate({
          where: {
            status: "COMPLETED",
            createdAt: { gte: previousStartDate, lt: startDate }
          },
          _sum: { amount: true },
          _count: true
        }),
        // New users current period
        db.user.count({
          where: { createdAt: { gte: startDate } }
        }),
        // New users previous period
        db.user.count({
          where: { createdAt: { gte: previousStartDate, lt: startDate } }
        }),
        // Projects by category
        db.project.groupBy({
          by: ["category"],
          where: { status: { in: ["LIVE", "FUNDED"] } },
          _count: true,
          _sum: { currentAmount: true }
        })
      ]);

      // Calculate growth percentages
      const visitGrowth = previousVisits > 0
        ? ((currentVisits - previousVisits) / previousVisits * 100)
        : currentVisits > 0 ? 100 : 0;

      const revenueGrowth = (previousPledges._sum.amount || 0) > 0
        ? (((currentPledges._sum.amount || 0) - (previousPledges._sum.amount || 0)) / (previousPledges._sum.amount || 1) * 100)
        : (currentPledges._sum.amount || 0) > 0 ? 100 : 0;

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
            current: currentPledges._sum.amount || 0,
            previous: previousPledges._sum.amount || 0,
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
            : 0
        },
        projectsByCategory: projectsByCategory.map(p => ({
          category: p.category,
          count: p._count,
          totalFunding: p._sum.currentAmount || 0
        }))
      });
    }

    if (tab === "revenue") {
      // Get revenue breakdown
      const [completedPledges, topProjects, pledgesByStatus] = await Promise.all([
        // Get all completed pledges in the period for grouping by day
        db.pledge.findMany({
          where: {
            status: "COMPLETED",
            createdAt: { gte: startDate }
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
            status: { in: ["LIVE", "FUNDED"] }
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
        // Pledges by status
        db.pledge.groupBy({
          by: ["status"],
          _count: true,
          _sum: { amount: true }
        })
      ]);

      // Group pledges by day manually
      const pledgesByDay = new Map<string, { total: number; count: number }>();
      completedPledges.forEach(pledge => {
        const dateKey = pledge.createdAt.toISOString().split('T')[0];
        const existing = pledgesByDay.get(dateKey) || { total: 0, count: 0 };
        existing.total += pledge.amount;
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
          byStatus: pledgesByStatus.map(p => ({
            status: p.status,
            count: p._count,
            total: p._sum.amount || 0
          }))
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
          _count: true
        }),
        // Recent projects with details
        db.project.findMany({
          where: { createdAt: { gte: startDate } },
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
          where: { status: { in: ["LIVE", "FUNDED"] } },
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
        const progress = (p.currentAmount / p.goalAmount) * 100;
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
      // Get geographic data
      const [countryData, cityData] = await Promise.all([
        // By country
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
            location: { not: null }
          },
          _count: true,
          orderBy: { _count: { location: "desc" } },
          take: 10
        })
      ]);

      return NextResponse.json({
        geography: {
          countries: countryData.map(c => ({
            country: c.country || "Unknown",
            visits: c._count
          })),
          cities: cityData.map(c => ({
            location: c.location,
            projectCount: c._count
          }))
        }
      });
    }

    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
