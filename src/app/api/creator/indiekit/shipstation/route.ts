import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitShipstationLogger = logger.child({ module: "creator-indiekit-shipstation" });
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { pushPledgesToShipStation } from "@/lib/fulfillment/shipstation-push";
import { syncShipStationTracking } from "@/lib/fulfillment/shipstation-tracking";

const actionSchema = z.object({
  projectId: z.string(),
  action: z.enum(["push_orders", "sync_tracking", "get_rates"]),
  backerIds: z.array(z.string()).optional(),
});

/**
 * ShipStation API Integration — V1 (legacy).
 *
 * Docs: https://www.shipstation.com/docs/api/
 *
 * This targets ShipStation API V1 (ssapi.shipstation.com, Basic auth with an
 * API key AND secret). ShipStation now describes V1 as "deprecated and will be
 * removed in the future" and gates it behind higher-tier plans; V2
 * (api.shipstation.com, a single `API-Key` header) is the going-forward API.
 *
 * V2 is not a drop-in swap: it has no orders endpoint at all. Its model is
 * shipments, labels and fulfillments, so pushing a pledge would mean
 * POST /v2/shipments with create_sales_order: true, and tracking would come
 * from the fulfillments/tracking endpoints rather than from an order record.
 * That is a rewrite of this file, not a base-URL change — tracked separately.
 *
 * The order-push mechanics (pacing, retry, order building) live in
 * lib/fulfillment/shipstation-push so the Packages tab's group/bulk pushes
 * (which go through /api/creator/indiekit/fulfillment) run the same code.
 */

// POST - Perform ShipStation actions
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action, backerIds } = actionSchema.parse(body);

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        creatorId: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    switch (action) {
      case "push_orders": {
        if (!backerIds || backerIds.length === 0) {
          return NextResponse.json({ error: "No backer IDs provided" }, { status: 400 });
        }

        const results = await pushPledgesToShipStation({
          projectId,
          creatorId: project.creatorId,
          projectTitle: project.title,
          pledgeIds: backerIds,
        });
        if (!results.success) {
          return NextResponse.json({ error: results.error }, { status: 400 });
        }

        return NextResponse.json({
          pushed: results.pushed,
          failed: results.failed,
          errors: results.errors,
          remaining: results.remaining,
        });
      }

      case "sync_tracking": {
        // Delegates to the shared library so the unattended cron can run the
        // same sync — it has no session and cannot come through this route.
        const result = await syncShipStationTracking(projectId, project.creatorId);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({
          synced: result.synced,
          pledgeIds: result.pledgeIds,
          remaining: result.remaining,
        });
      }

      case "get_rates": {
        // Get shipping rates - would need package details
        return NextResponse.json({ error: "Rate calculation not yet implemented" }, { status: 501 });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    creatorIndiekitShipstationLogger.error({ err: formatError(error) }, "ShipStation API error:");
    return NextResponse.json({ error: "Failed to process ShipStation request" }, { status: 500 });
  }
}
