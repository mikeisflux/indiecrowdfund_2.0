import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { getPlatformTotals } from "@/lib/stats";

const homeStatsLogger = logger.child({ module: "home-stats" });

export const dynamic = "force-dynamic";

/**
 * GET /api/home-stats
 * Lightweight endpoint for home page stat polling.
 * Delegates pledge/project aggregation to getPlatformTotals() then adds
 * home-page-specific fields (backerPool, certifiedRetailers, successRate).
 */
export async function GET() {
  try {
    const [totals, backerPool, certifiedRetailers] = await Promise.all([
      getPlatformTotals(),
      db.user.count({ where: { deletedAt: null, lockedAt: null } }),
      db.retailer.count({ where: { status: "APPROVED" } }).catch(() => 0),
    ]);

    // Success rate: funded projects / all projects that have ended
    // Use projectsFunded from totals (projects that actually reached FUNDED status)
    // and projectsTotal for the denominator of ended campaigns
    const activeProjects = await db.project.findMany({
      where: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
      select: { goalAmount: true, endDate: true, status: true },
    });

    const now = new Date();
    const endedProjects = activeProjects.filter((p) => p.endDate && new Date(p.endDate) < now);
    const successfulEnded = endedProjects.filter((p) => p.status === "FUNDED").length;
    const successRate =
      endedProjects.length > 0 ? Math.round((successfulEnded / endedProjects.length) * 100) : 0;

    return NextResponse.json(
      {
        totalPledged: totals.totalRaised,
        projectsFunded: totals.projectsFunded,
        successRate,
        backerPool,
        certifiedRetailers,
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    homeStatsLogger.error({ err: String(error) }, "Error fetching home stats:");
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
