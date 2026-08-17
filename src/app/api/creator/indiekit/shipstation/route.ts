import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitShipstationLogger = logger.child({ module: "creator-indiekit-shipstation" });
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { circuitBreaker } from "@/lib/circuit-breaker";
import { resolvePledgeShippingAddress } from "@/lib/fulfillment/shipping-address";
import { resolveShipStationCredentials } from "@/lib/fulfillment/shipstation-credentials";

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
 */

// V1 rate limit is 40 requests per minute per key pair. Every call below goes
// through shipStationFetch so a bulk push paces itself instead of walking into
// a wall of 429s partway down a backer list and reporting them as failures.
const V1_MIN_GAP_MS = 1_600;
// Server-side budget for one bulk push. Past this the handler returns what it
// managed and tells the caller how many are left, rather than being killed
// mid-flight with no record of where it got to.
const PUSH_BUDGET_MS = 45_000;

let lastShipStationCallAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Rate-limit-aware ShipStation V1 call.
 *
 * Paces requests to stay inside the 40/minute limit, and on a 429 waits for
 * the window named by X-Rate-Limit-Reset before retrying. V1 sends that header
 * rather than Retry-After, so generic retry logic misses it.
 */
async function shipStationFetch(
  url: string,
  init: RequestInit,
  attempt = 0
): Promise<Response> {
  const since = Date.now() - lastShipStationCallAt;
  if (since < V1_MIN_GAP_MS) await sleep(V1_MIN_GAP_MS - since);
  lastShipStationCallAt = Date.now();

  const response = await circuitBreaker.execute("shipstation", () => fetch(url, init));

  if (response.status === 429 && attempt < 2) {
    const reset = Number(response.headers.get("X-Rate-Limit-Reset") || "0");
    // Cap the wait so a hostile or malformed header can't park the request.
    await sleep(Math.min(Math.max(reset, 1) * 1000, 20_000));
    return shipStationFetch(url, init, attempt + 1);
  }

  return response;
}

// Base64 encode API credentials for ShipStation auth
function getShipStationAuthHeader(apiKey: string, apiSecret: string): string {
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  return `Basic ${credentials}`;
}

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

    // Credentials for this project: the connection made on the campaign
    // itself if there is one, otherwise the creator's account-level keys from
    // before connections were project-scoped.
    const credentials = await resolveShipStationCredentials(projectId, project.creatorId);

    if (!credentials) {
      return NextResponse.json(
        {
          error:
            "ShipStation isn't connected for this campaign. The creator or an accepted collaborator can connect it in IndieKit under Settings > Integrations.",
        },
        { status: 400 }
      );
    }

    const authHeader = getShipStationAuthHeader(credentials.apiKey, credentials.apiSecret);

    switch (action) {
      case "push_orders": {
        if (!backerIds || backerIds.length === 0) {
          return NextResponse.json({ error: "No backer IDs provided" }, { status: 400 });
        }

        // Get pledges with shipping info
        const pledges = await db.pledge.findMany({
          where: {
            id: { in: backerIds },
            projectId,
          },
          include: {
            user: { select: { email: true, name: true } },
            surveyResponse: true,
            reward: true,
            addons: {
              include: {
                addon: true,
              },
            },
          },
        });

        const results = {
          pushed: 0,
          failed: 0,
          errors: [] as string[],
          // Backers not attempted this call. Pacing for the 40/minute limit
          // means a long list cannot finish inside one request; the caller
          // re-submits the remainder rather than the run dying silently.
          remaining: 0,
        };

        const startedAt = Date.now();

        // Push each order to ShipStation
        for (const [index, pledge] of pledges.entries()) {
          if (Date.now() - startedAt > PUSH_BUDGET_MS) {
            results.remaining = pledges.length - index;
            break;
          }
          try {
            const shippingAddress = resolvePledgeShippingAddress(
              pledge.surveyResponse?.shippingAddress,
              pledge.shippingAddress
            );
            if (!shippingAddress) {
              results.failed++;
              results.errors.push(`Pledge ${pledge.id}: No shipping address`);
              continue;
            }

            // Build line items.
            //
            // Reward.amount is Decimal(10,2) in DOLLARS, and there is no
            // `price` or `sku` column on Reward at all. The previous code read
            // `reward.price / 100`, which is undefined / 100 = NaN, and
            // JSON.stringify writes NaN as null — so every line item reached
            // ShipStation priced at null. Prisma's result types would normally
            // have caught that; they are erased by the $allOperations extension
            // in lib/db, so it compiled cleanly. Same for the `sku` reads,
            // which silently always fell through to the generated fallback.
            const items = [];
            if (pledge.reward) {
              items.push({
                lineItemKey: `reward-${pledge.reward.id}`,
                sku: `REWARD-${pledge.reward.id}`,
                name: pledge.reward.title,
                quantity: 1,
                unitPrice: Number(pledge.reward.amount),
              });
            }

            for (const addonEntry of pledge.addons) {
              items.push({
                lineItemKey: `addon-${addonEntry.addon.id}`,
                sku: `ADDON-${addonEntry.addon.id}`,
                name: addonEntry.addon.title,
                quantity: addonEntry.quantity,
                unitPrice: Number(addonEntry.addon.amount),
              });
            }

            // Create ShipStation order
            const orderData = {
              orderNumber: `ICF-${pledge.id.substring(0, 8)}`,
              // createorder is an upsert keyed on orderKey. Without one, every
              // re-push of the same backer creates a duplicate order for the
              // fulfilment house to pick, pack and ship twice.
              orderKey: `icf-${pledge.id}`,
              orderDate: pledge.createdAt.toISOString(),
              orderStatus: "awaiting_shipment",
              customerEmail: pledge.user.email,
              billTo: {
                name: shippingAddress.name || pledge.user.name || "Unknown",
                street1: shippingAddress.line1,
                street2: shippingAddress.line2 || "",
                city: shippingAddress.city,
                state: shippingAddress.state,
                postalCode: shippingAddress.postalCode,
                country: shippingAddress.country,
              },
              shipTo: {
                name: shippingAddress.name || pledge.user.name || "Unknown",
                street1: shippingAddress.line1,
                street2: shippingAddress.line2 || "",
                city: shippingAddress.city,
                state: shippingAddress.state,
                postalCode: shippingAddress.postalCode,
                country: shippingAddress.country,
              },
              items,
              // Pledge.amount is Decimal(10,2) in dollars. Dividing by 100
              // reported a $53 pledge to ShipStation as $0.53.
              amountPaid: Number(pledge.amount),
              internalNotes: `IndieCrowdfund · ${project.title} · Backer #${pledge.backerNumber || pledge.id}`,
              // Which ShipStation store the order imports into. Chosen on the
              // Integrations tab; omitted entirely when unset so ShipStation
              // applies the account default rather than receiving a null and
              // rejecting the order.
              ...(credentials.storeId
                ? { advancedOptions: { storeId: credentials.storeId } }
                : {}),
            };

            const response = await shipStationFetch(
              "https://ssapi.shipstation.com/orders/createorder",
              {
                method: "POST",
                headers: {
                  Authorization: authHeader,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(orderData),
              }
            );

            if (response.ok) {
              const result = await response.json();

              // Store ShipStation order ID
              await db.pledge.update({
                where: { id: pledge.id },
                data: {
                  externalOrderId: String(result.orderId),
                  fulfillmentStatus: "IN_PROGRESS",
                },
              });

              results.pushed++;
            } else {
              const errorData = await response.json().catch(() => ({}));
              results.failed++;
              results.errors.push(`Pledge ${pledge.id}: ${errorData.Message || response.statusText}`);
            }
          } catch (error) {
            results.failed++;
            results.errors.push(`Pledge ${pledge.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }

        return NextResponse.json(results);
      }

      case "sync_tracking": {
        // Sync tracking information from ShipStation.
        // Prisma 7 rejects `{ field: { not: null } }` on nullable string
        // fields at runtime — use `NOT: { field: null }` wrapper instead.
        const pledgesWithOrders = await db.pledge.findMany({
          where: {
            projectId,
            NOT: { externalOrderId: null },
            fulfillmentStatus: { in: ["IN_PROGRESS", "PROCESSING"] },
          },
        });

        const updated = [];
        const startedAt = Date.now();
        let remaining = 0;

        for (const pledge of pledgesWithOrders) {
          if (Date.now() - startedAt > PUSH_BUDGET_MS) {
            remaining = pledgesWithOrders.length - updated.length;
            break;
          }
          try {
            // Tracking comes from the shipments endpoint, not the order.
            //
            // This used to GET /orders/{orderId} and read `order.shipments`.
            // A V1 order object carries no shipments array, so the check was
            // always false: tracking numbers were never written and nothing
            // was ever marked SHIPPED, no matter how much had gone out. That
            // is why a fulfilment partner could not signal shipped status back
            // to the platform for backers to see.
            const response = await shipStationFetch(
              `https://ssapi.shipstation.com/shipments?orderId=${encodeURIComponent(
                String(pledge.externalOrderId)
              )}`,
              { headers: { Authorization: authHeader } }
            );

            if (response.ok) {
              const body = await response.json();
              // Voided shipments are returned by default and must be skipped,
              // or a cancelled label would mark the pledge shipped.
              const shipment = (body.shipments || []).find(
                (s: { voided?: boolean; trackingNumber?: string | null }) =>
                  !s.voided && s.trackingNumber
              );
              if (shipment) {
                await db.pledge.update({
                  where: { id: pledge.id },
                  data: {
                    trackingNumber: shipment.trackingNumber,
                    fulfillmentStatus: "SHIPPED",
                  },
                });
                updated.push(pledge.id);
              }
            }
          } catch {
            // Continue with other pledges
          }
        }

        return NextResponse.json({
          synced: updated.length,
          pledgeIds: updated,
          remaining,
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
