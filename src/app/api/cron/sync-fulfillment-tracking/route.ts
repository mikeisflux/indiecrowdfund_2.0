import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { db } from "@/lib/db";
import { syncShopifyTracking } from "@/lib/shopify-push";
import { syncShipStationTracking } from "@/lib/fulfillment/shipstation-tracking";

const cronSyncTrackingLogger = logger.child({ module: "cron-sync-fulfillment-tracking" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Pull tracking numbers back from the fulfillment services.
 *
 * Orders went OUT to ShipStation, Shippo, EasyPost, Stamps and Shopify, and
 * nothing ever came back. The per-carrier sync endpoints existed but had no
 * caller — no button, no schedule — so a creator could buy a hundred labels
 * and every one of those backers would still see "not shipped" on their
 * pledge until somebody marked it by hand.
 *
 * Runs per project rather than globally so one campaign's broken credentials
 * cannot stall everyone else's tracking.
 *
 * Crontab (localhost so a DNS blip can't kill it):
 *   0,30 * * * * . /root/indiecrowdfund_2.0/.env && \
 *     curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/sync-fulfillment-tracking > /dev/null 2>&1
 */

// Only the providers whose sync exists as a library function can run here.
// The Shippo, EasyPost and Stamps syncs still live inside their routes, which
// authenticate a creator session — a cron has none, and calling them over HTTP
// would just 401. Those three sync when a creator presses the button; pulling
// them out the way ShipStation was is the follow-up.
const AUTOMATED_PROVIDERS = new Set(["SHIPSTATION", "SHOPIFY"]);

// Whole-run ceiling, comfortably inside maxDuration. Each provider call has
// its own internal budget and reports what it did not reach, so stopping
// early just means the next run picks up where this one left off.
const RUN_BUDGET_MS = 240_000;

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    // Only campaigns that actually have something outstanding. A project whose
    // orders are all delivered has nothing to ask a carrier about, and polling
    // it every half hour would burn rate limit for nothing.
    const projectsWithOpenOrders = await db.pledge.groupBy({
      by: ["projectId"],
      where: {
        deletedAt: null,
        fulfillmentStatus: { in: ["IN_PROGRESS", "PROCESSING"] },
      },
    });
    const candidateIds = projectsWithOpenOrders.map(
      (row: { projectId: string }) => row.projectId
    );

    if (candidateIds.length === 0) {
      return NextResponse.json({ ok: true, projects: 0, synced: 0 });
    }

    const integrations = await db.fulfillmentIntegration.findMany({
      where: { projectId: { in: candidateIds }, status: "CONNECTED" },
      select: { projectId: true, provider: true },
    });

    const byProject = new Map<string, string[]>();
    for (const i of integrations as { projectId: string; provider: string }[]) {
      if (!AUTOMATED_PROVIDERS.has(i.provider)) continue;
      byProject.set(i.projectId, [...(byProject.get(i.projectId) || []), i.provider]);
    }

    // ShipStation credentials can be stored on the campaign or fall back to
    // the creator's account-level keys, so the sync needs the creator id.
    const projects = await db.project.findMany({
      where: { id: { in: [...byProject.keys()] } },
      select: { id: true, creatorId: true },
    });
    const creatorByProject = new Map(
      projects.map((p: { id: string; creatorId: string }) => [p.id, p.creatorId])
    );

    let totalSynced = 0;
    let projectsProcessed = 0;
    let projectsSkipped = 0;
    const errors: string[] = [];

    for (const [projectId, providers] of byProject) {
      if (Date.now() - startedAt > RUN_BUDGET_MS) {
        projectsSkipped = byProject.size - projectsProcessed;
        break;
      }
      projectsProcessed++;

      for (const provider of providers) {
        try {
          if (provider === "SHOPIFY") {
            const result = await syncShopifyTracking(projectId);
            totalSynced += result.synced;
            if (result.errors?.length) {
              errors.push(`${projectId} Shopify: ${result.errors[0]}`);
            }
            continue;
          }

          if (provider === "SHIPSTATION") {
            const creatorId = creatorByProject.get(projectId);
            if (!creatorId) continue;
            const result = await syncShipStationTracking(projectId, creatorId);
            totalSynced += result.synced;
            if (result.error) errors.push(`${projectId} ShipStation: ${result.error}`);
          }
        } catch (providerError) {
          const message =
            providerError instanceof Error ? providerError.message : "Unknown error";
          errors.push(`${projectId} ${provider}: ${message}`);
        }
      }
    }

    cronSyncTrackingLogger.info(
      { projectsProcessed, projectsSkipped, totalSynced, errorCount: errors.length },
      "Fulfillment tracking sync run complete"
    );

    return NextResponse.json({
      ok: true,
      projects: projectsProcessed,
      skipped: projectsSkipped,
      synced: totalSynced,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    cronSyncTrackingLogger.error({ err: formatError(error) }, "Tracking sync cron failed");
    return NextResponse.json({ error: "Tracking sync failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
