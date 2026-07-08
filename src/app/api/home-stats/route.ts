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
 *
 * Resilience: each subordinate query is wrapped in its own catch with a
 * zero-fallback. The home page's marquee numbers should NEVER surface a
 * 500 to a visitor — better to render zeros than to break the banner.
 * Real platform-wide DB outages get caught upstream by the health
 * check; momentary blips (connection-pool exhaustion, pm2 reload race
 * during a credential rotation, single replica hiccup) shouldn't take
 * down the homepage. Observed real-world: the 2026-05-06 02:47–02:54
 * window where stale Prisma connections held the OLD password through
 * a credential rotation surfaced as 500s here for ~7 minutes.
 */
export async function GET() {
  try {
    const totalsP = getPlatformTotals().catch((err) => {
      homeStatsLogger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "getPlatformTotals failed; falling back to zeros"
      );
      return {
        totalRaised: 0,
        totalBackers: 0,
        totalPledges: 0,
        projectsFunded: 0,
        projectsLive: 0,
        projectsTotal: 0,
        totalCreators: 0,
        totalUsers: 0,
        categoryCounts: [] as { category: string; count: number }[],
      };
    });
    const backerPoolP = db.user
      .count({ where: { deletedAt: null, lockedAt: null } })
      .catch((err) => {
        homeStatsLogger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "backerPool count failed; falling back to 0"
        );
        return 0;
      });
    const certifiedRetailersP = db.retailer
      .count({ where: { status: "APPROVED" } })
      .catch(() => 0);
    const activeProjectsP = db.project
      .findMany({
        where: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
        select: { goalAmount: true, endDate: true, status: true },
      })
      .catch((err) => {
        homeStatsLogger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "activeProjects query failed; success rate will fall back to 0"
        );
        return [] as Array<{ goalAmount: unknown; endDate: Date | null; status: string }>;
      });

    const [totals, backerPool, certifiedRetailers, activeProjects] = await Promise.all([
      totalsP,
      backerPoolP,
      certifiedRetailersP,
      activeProjectsP,
    ]);

    // Success rate: funded projects / all projects that have ended
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
    // Reachable only if something outside the per-query catches throws
    // (JSON serialization, NextResponse construction). Log with stack
    // so we can diagnose if this ever does fire.
    homeStatsLogger.error(
      {
        err: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Error fetching home stats"
    );
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
