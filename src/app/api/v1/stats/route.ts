import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { getPlatformTotals } from "@/lib/stats";
import { authenticateApiRequest } from "@/lib/api/auth";
import { apiJson, apiError, apiOptions, checkRateLimit, rateLimitHeaders } from "@/lib/api/respond";

const log = logger.child({ module: "api-v1-stats" });

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

/**
 * Platform-wide totals — the aggregate figures a tracking site publishes.
 *
 * Aggregates only. `totalUsers` from getPlatformTotals is deliberately NOT
 * forwarded: registered-account count is a business metric that isn't shown
 * anywhere public, and unlike the rest of these it says nothing about
 * campaigns. Creator count is included because creator profiles are public
 * pages and the number is derivable by anyone willing to crawl them.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;

  const rate = checkRateLimit(auth.key.id);
  if (!rate.allowed) {
    return apiError("rate_limited", "Rate limit exceeded. Try again shortly.", 429);
  }

  try {
    const t = await getPlatformTotals();

    return apiJson(
      {
        data: {
          currency: "USD",
          total_raised: t.totalRaised,
          total_pledges: t.totalPledges,
          total_backers: t.totalBackers,
          total_creators: t.totalCreators,
          projects_total: t.projectsTotal,
          projects_live: t.projectsLive,
          projects_funded: t.projectsFunded,
          success_rate:
            t.projectsTotal > 0
              ? Math.round((t.projectsFunded / t.projectsTotal) * 1000) / 10
              : 0,
          average_pledge:
            t.totalPledges > 0 ? Math.round((t.totalRaised / t.totalPledges) * 100) / 100 : 0,
          categories: t.categoryCounts.map((c) => ({
            category: c.category,
            project_count: c.count,
          })),
          generated_at: new Date().toISOString(),
        },
      },
      {
        headers: {
          ...rateLimitHeaders(rate),
          // Platform totals move slowly and are the most-polled endpoint;
          // a longer window keeps a fleet of trackers off the aggregate query.
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      }
    );
  } catch (error) {
    log.error({ err: formatError(error) }, "GET /api/v1/stats failed");
    return apiError("internal_error", "Failed to load platform statistics.", 500);
  }
}
