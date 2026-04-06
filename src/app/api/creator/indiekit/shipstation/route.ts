import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorIndiekitShipstationLogger = logger.child({ module: "creator-indiekit-shipstation" });
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { circuitBreaker } from "@/lib/circuit-breaker";

const actionSchema = z.object({
  projectId: z.string(),
  action: z.enum(["push_orders", "sync_tracking", "get_rates"]),
  backerIds: z.array(z.string()).optional(),
});

/**
 * ShipStation API Integration
 * API Docs: https://www.shipstation.com/docs/api/
 */

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

    // Get PROJECT CREATOR's ShipStation credentials
    // Collaborators use the creator's connection, not their own
    const creator = await db.user.findUnique({
      where: { id: project.creatorId },
      select: {
        shipstationApiKey: true,
        shipstationApiSecret: true,
      },
    });

    if (!creator?.shipstationApiKey || !creator?.shipstationApiSecret) {
      return NextResponse.json(
        { error: "ShipStation credentials not configured. The project creator must add their API Key and Secret in Settings." },
        { status: 400 }
      );
    }

    const authHeader = getShipStationAuthHeader(creator.shipstationApiKey, creator.shipstationApiSecret);

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
            surveyResponse: {
              include: {
                shippingAddress: true,
              },
            },
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
        };

        // Push each order to ShipStation
        for (const pledge of pledges) {
          try {
            const shippingAddress = pledge.surveyResponse?.shippingAddress;
            if (!shippingAddress) {
              results.failed++;
              results.errors.push(`Pledge ${pledge.id}: No shipping address`);
              continue;
            }

            // Build line items
            const items = [];
            if (pledge.reward) {
              items.push({
                lineItemKey: `reward-${pledge.reward.id}`,
                sku: pledge.reward.sku || `REWARD-${pledge.reward.id}`,
                name: pledge.reward.title,
                quantity: 1,
                unitPrice: pledge.reward.price / 100,
              });
            }

            for (const addonEntry of pledge.addons) {
              items.push({
                lineItemKey: `addon-${addonEntry.addon.id}`,
                sku: addonEntry.addon.sku || `ADDON-${addonEntry.addon.id}`,
                name: addonEntry.addon.title,
                quantity: addonEntry.quantity,
                unitPrice: addonEntry.addon.price / 100,
              });
            }

            // Create ShipStation order
            const orderData = {
              orderNumber: `ICF-${pledge.id.substring(0, 8)}`,
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
              amountPaid: Number(pledge.amount) / 100,
              internalNotes: `IndieKit pledge from ${project.title}`,
            };

            const response = await circuitBreaker.execute("shipstation", () =>
              fetch("https://ssapi.shipstation.com/orders/createorder", {
                method: "POST",
                headers: {
                  "Authorization": authHeader,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(orderData),
              })
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
        // Sync tracking information from ShipStation
        const pledgesWithOrders = await db.pledge.findMany({
          where: {
            projectId,
            externalOrderId: { not: null },
            fulfillmentStatus: { in: ["IN_PROGRESS", "PROCESSING"] },
          },
        });

        const updated = [];
        for (const pledge of pledgesWithOrders) {
          try {
            const response = await circuitBreaker.execute("shipstation", () =>
              fetch(
                `https://ssapi.shipstation.com/orders/${pledge.externalOrderId}`,
                {
                  headers: { Authorization: authHeader },
                }
              )
            );

            if (response.ok) {
              const order = await response.json();
              if (order.shipments && order.shipments.length > 0) {
                const shipment = order.shipments[0];
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

        return NextResponse.json({ synced: updated.length, pledgeIds: updated });
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
    creatorIndiekitShipstationLogger.error({ err: String(error) }, "ShipStation API error:");
    return NextResponse.json({ error: "Failed to process ShipStation request" }, { status: 500 });
  }
}
