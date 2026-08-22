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

const log = logger.child({ module: "api-v1-project-detail" });

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;

  const rate = checkRateLimit(auth.key.id);
  if (!rate.allowed) {
    return apiError("rate_limited", "Rate limit exceeded. Try again shortly.", 429);
  }

  try {
    const { slug } = await params;

    const project = await db.project.findFirst({
      where: {
        slug,
        deletedAt: null,
        // A non-public campaign must 404 rather than 403 — a distinguishable
        // "exists but hidden" response would let anyone enumerate unlaunched
        // campaigns by guessing slugs.
        status: { in: [...PUBLIC_PROJECT_STATUSES] as ("LIVE")[] },
      },
      select: {
        ...PUBLIC_PROJECT_SELECT,
        // Detail-only additions, both already rendered on the public page.
        description: true,
        risks: true,
        rewards: {
          where: { deletedAt: null, type: "TIER" },
          select: {
            id: true,
            title: true,
            description: true,
            amount: true,
            quantityAvailable: true,
            quantityClaimed: true,
            estimatedDelivery: true,
            shippingType: true,
          },
          orderBy: { amount: "asc" },
        },
      },
    });

    if (!project) {
      return apiError("not_found", `No public project with slug "${slug}".`, 404);
    }

    const statsMap = await getBatchProjectStats([
      {
        id: project.id,
        status: project.status,
        goalAmount: project.goalAmount as unknown as number,
      },
    ]);

    const base = serializeProject(
      project as unknown as Record<string, unknown>,
      statsMap.get(project.id)
    );

    type RewardRow = {
      id: string;
      title: string;
      description: string | null;
      amount: unknown;
      quantityAvailable: number | null;
      quantityClaimed: number;
      estimatedDelivery: Date | null;
      shippingType: string;
    };

    return apiJson(
      {
        data: {
          ...base,
          description: project.description,
          risks: project.risks,
          // Backer identities are never included. Claimed counts are the same
          // "N of M left" figure the public reward tiles already show.
          rewards: (project.rewards as RewardRow[]).map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            amount: Number(String(r.amount)),
            quantity_available: r.quantityAvailable,
            quantity_claimed: r.quantityClaimed,
            quantity_remaining:
              r.quantityAvailable == null
                ? null
                : Math.max(0, r.quantityAvailable - r.quantityClaimed),
            estimated_delivery: r.estimatedDelivery
              ? new Date(r.estimatedDelivery).toISOString()
              : null,
            shipping_type: r.shippingType,
          })),
        },
      },
      { headers: rateLimitHeaders(rate) }
    );
  } catch (error) {
    log.error({ err: formatError(error) }, "GET /api/v1/projects/[slug] failed");
    return apiError("internal_error", "Failed to load project.", 500);
  }
}
