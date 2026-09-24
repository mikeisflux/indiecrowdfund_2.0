import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitShipstationLogger = logger.child({ module: "creator-indiekit-shipstation" });
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  pushPledgesToShipStation,
  shipStationFetch,
  getShipStationAuthHeader,
} from "@/lib/fulfillment/shipstation-push";
import { syncShipStationTracking } from "@/lib/fulfillment/shipstation-tracking";
import { resolveShipStationCredentials } from "@/lib/fulfillment/shipstation-credentials";

const actionSchema = z.object({
  projectId: z.string(),
  action: z.enum(["push_orders", "sync_tracking", "get_rates"]),
  backerIds: z.array(z.string()).optional(),
  // get_rates only
  weightOz: z.number().positive().max(70 * 16).optional(),
  fromPostalCode: z.string().trim().min(2).max(12).optional(),
  toCountry: z.string().trim().length(2).optional(),
  toPostalCode: z.string().trim().min(2).max(12).optional(),
  toCity: z.string().trim().max(80).optional(),
  toState: z.string().trim().max(40).optional(),
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
        // Rate estimate for one package: ask every carrier on the
        // connected ShipStation account to quote the given weight and
        // route (V1 /shipments/getrates). Package weights come from the
        // customs/weight data saved on the Packages tab.
        const parsedBody = actionSchema.parse(body);
        const { weightOz, fromPostalCode, toPostalCode, toCity, toState } = parsedBody;
        const toCountry = (parsedBody.toCountry || "US").toUpperCase();
        if (!weightOz || !fromPostalCode || !toPostalCode) {
          return NextResponse.json(
            { error: "Weight, ship-from ZIP, and destination postal code are required" },
            { status: 400 }
          );
        }

        const credentials = await resolveShipStationCredentials(projectId, project.creatorId);
        if (!credentials) {
          return NextResponse.json(
            {
              error:
                "ShipStation isn't connected for this campaign. Connect it in IndieKit under Settings > Integrations.",
            },
            { status: 400 }
          );
        }
        const authHeader = getShipStationAuthHeader(credentials.apiKey, credentials.apiSecret);

        const carriersRes = await shipStationFetch("https://ssapi.shipstation.com/carriers", {
          headers: { Authorization: authHeader },
        });
        if (!carriersRes.ok) {
          return NextResponse.json(
            { error: `ShipStation rejected the carriers lookup (${carriersRes.status})` },
            { status: 502 }
          );
        }
        const carriers = ((await carriersRes.json().catch(() => [])) as {
          code?: string;
          name?: string;
        }[]).filter((c) => c.code);

        if (carriers.length === 0) {
          return NextResponse.json(
            { error: "No carriers are configured on the connected ShipStation account" },
            { status: 400 }
          );
        }

        const rates: {
          carrierCode: string;
          carrierName: string;
          serviceName: string;
          serviceCode: string;
          shipmentCost: number;
          otherCost: number;
          total: number;
        }[] = [];
        const carrierErrors: string[] = [];

        // Each carrier is a paced V1 call; cap so an account with many
        // carriers can't run the request into the route timeout.
        for (const carrier of carriers.slice(0, 4)) {
          try {
            const res = await shipStationFetch(
              "https://ssapi.shipstation.com/shipments/getrates",
              {
                method: "POST",
                headers: {
                  Authorization: authHeader,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  carrierCode: carrier.code,
                  fromPostalCode,
                  toCountry,
                  toPostalCode,
                  ...(toCity ? { toCity } : {}),
                  ...(toState ? { toState } : {}),
                  weight: { value: Math.round(weightOz * 10) / 10, units: "ounces" },
                  confirmation: "none",
                  residential: true,
                }),
              }
            );
            const data = (await res.json().catch(() => null)) as
              | { serviceName?: string; serviceCode?: string; shipmentCost?: number; otherCost?: number }[]
              | { Message?: string; ExceptionMessage?: string }
              | null;
            if (!res.ok || !Array.isArray(data)) {
              const message =
                data && !Array.isArray(data)
                  ? data.ExceptionMessage || data.Message || `HTTP ${res.status}`
                  : `HTTP ${res.status}`;
              // A carrier that can't serve this route (e.g. domestic-only
              // for an international destination) is normal, not fatal.
              carrierErrors.push(`${carrier.name || carrier.code}: ${message}`);
              continue;
            }
            for (const rate of data) {
              const shipmentCost = Number(rate.shipmentCost) || 0;
              const otherCost = Number(rate.otherCost) || 0;
              rates.push({
                carrierCode: carrier.code!,
                carrierName: carrier.name || carrier.code!,
                serviceName: rate.serviceName || rate.serviceCode || "Service",
                serviceCode: rate.serviceCode || "",
                shipmentCost,
                otherCost,
                total: Math.round((shipmentCost + otherCost) * 100) / 100,
              });
            }
          } catch (err) {
            carrierErrors.push(
              `${carrier.name || carrier.code}: ${err instanceof Error ? err.message : "request failed"}`
            );
          }
        }

        rates.sort((a, b) => a.total - b.total);

        if (rates.length === 0) {
          return NextResponse.json(
            {
              error: `No carrier returned rates for this route${carrierErrors.length ? ` — ${carrierErrors[0]}` : ""}`,
            },
            { status: 400 }
          );
        }

        return NextResponse.json({ rates, carrierErrors });
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
