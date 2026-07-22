import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { getPlatformStats } from "@/lib/stats/actions";

const homeStatsLogger = logger.child({ module: "home-stats" });

export const dynamic = "force-dynamic";

/**
 * GET /api/home-stats
 * Lightweight endpoint for home page stat polling.
 *
 * IMPORTANT: this delegates to the SAME getPlatformStats() the home page
 * uses for its server render. It previously computed successRate and
 * projectsFunded with its own (status-based) rules, so the numbers
 * visibly flipped ~30s after page load when the poller's answer replaced
 * the server-rendered one (e.g. 96% -> 89%). One source of truth only.
 *
 * Resilience: getPlatformStats() catches internally and returns zeros;
 * the retailer count has its own zero-fallback. The home page's marquee
 * numbers should NEVER surface a 500 to a visitor — better to render
 * zeros than to break the banner. Momentary blips (connection-pool
 * exhaustion, pm2 reload race during a credential rotation, single
 * replica hiccup) shouldn't take down the homepage. Observed real-world:
 * the 2026-05-06 02:47–02:54 window where stale Prisma connections held
 * the OLD password through a credential rotation surfaced as 500s here
 * for ~7 minutes.
 */
export async function GET() {
  try {
    const [stats, certifiedRetailers] = await Promise.all([
      getPlatformStats(),
      db.retailer.count({ where: { status: "APPROVED" } }).catch((err) => {
        homeStatsLogger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "certifiedRetailers count failed; falling back to 0"
        );
        return 0;
      }),
    ]);

    return NextResponse.json(
      {
        totalPledged: stats.totalPledged,
        projectsFunded: stats.projectsFunded,
        successRate: stats.successRate,
        backerPool: stats.backerPool,
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
