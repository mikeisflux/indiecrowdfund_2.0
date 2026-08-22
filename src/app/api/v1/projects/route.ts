import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { getBatchProjectStats } from "@/lib/stats";
import { authenticateApiRequest } from "@/lib/api/auth";
import { apiJson, apiError, apiOptions, checkRateLimit, rateLimitHeaders } from "@/lib/api/respond";
import {
  PUBLIC_PROJECT_SELECT,
  PUBLIC_PROJECT_STATUSES,
  serializeProject,
} from "@/lib/api/serializers";

const log = logger.child({ module: "api-v1-projects" });

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

const SORTS: Record<string, Record<string, "asc" | "desc">> = {
  newest: { createdAt: "desc" },
  ending_soon: { endDate: "asc" },
  most_funded: { currentAmount: "desc" },
  most_backed: { backerCount: "desc" },
};

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;

  const rate = checkRateLimit(auth.key.id);
  if (!rate.allowed) {
    return apiError("rate_limited", "Rate limit exceeded. Try again shortly.", 429);
  }

  try {
    const sp = req.nextUrl.searchParams;

    // Hard ceiling on page size. Without it a tracker can ask for the whole
    // table in one query and turn a polling loop into a database problem.
    const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50) || 50, 1), 100);
    const offset = Math.max(Number(sp.get("offset") ?? 0) || 0, 0);

    const statusParam = sp.get("status")?.toUpperCase();
    const status =
      statusParam && (PUBLIC_PROJECT_STATUSES as readonly string[]).includes(statusParam)
        ? statusParam
        : undefined;

    const category = sp.get("category") || undefined;
    const sort = SORTS[sp.get("sort") ?? "newest"] ?? SORTS.newest;

    // `updated_since` lets a tracker poll incrementally instead of re-walking
    // the catalogue every run.
    const since = sp.get("updated_since");
    const sinceDate = since ? new Date(since) : null;
    if (since && (!sinceDate || Number.isNaN(sinceDate.getTime()))) {
      return apiError("invalid_parameter", "updated_since must be an ISO 8601 timestamp.", 400);
    }

    const where = {
      deletedAt: null,
      // Never widen this. Only already-public campaigns are exposed —
      // see PUBLIC_PROJECT_STATUSES.
      status: status
        ? (status as "LIVE")
        : { in: [...PUBLIC_PROJECT_STATUSES] as ("LIVE")[] },
      ...(category ? { category } : {}),
      ...(sinceDate ? { updatedAt: { gte: sinceDate } } : {}),
    };

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        select: PUBLIC_PROJECT_SELECT,
        orderBy: sort,
        take: limit,
        skip: offset,
      }),
      db.project.count({ where }),
    ]);

    // Same live aggregation the website uses, so the API and the page agree.
    const statsMap = await getBatchProjectStats(
      projects.map((p: { id: string; status: string; goalAmount: unknown }) => ({
        id: p.id,
        status: p.status,
        goalAmount: p.goalAmount as number,
      }))
    );

    return apiJson(
      {
        data: projects.map((p: Record<string, unknown>) =>
          serializeProject(p, statsMap.get(String(p.id)))
        ),
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + projects.length < total,
        },
      },
      { headers: rateLimitHeaders(rate) }
    );
  } catch (error) {
    log.error({ err: formatError(error) }, "GET /api/v1/projects failed");
    return apiError("internal_error", "Failed to load projects.", 500);
  }
}
