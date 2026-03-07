import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";

const creatorIndiekitShippoLogger = logger.child({ module: "creator-indiekit-shippo" });
import { db } from "@/lib/db";
import { z } from "zod";
import { circuitBreaker } from "@/lib/circuit-breaker";

const actionSchema = z.object({
  projectId: z.string(),
  action: z.enum(["push_orders", "sync_tracking", "get_rates", "create_shipment"]),
  backerIds: z.array(z.string()).optional(),
});

/**
 * Shippo API Integration
 * API Docs: https://docs.goshippo.com/
 */

// POST - Perform Shippo actions
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

    // Get PROJECT CREATOR's Shippo credentials
    // Collaborators use the creator's connection, not their own
    const creator = await db.user.findUnique({
      where: { id: project.creatorId },
      select: {
        shippoApiToken: true,
      },
    });

    if (!creator?.shippoApiToken) {
      return NextResponse.json(
        { error: "Shippo credentials not configured. The project creator must add their API Token in Settings." },
        { status: 400 }
      );
    }

    const shippoHeaders = {
      "Authorization": `ShippoToken ${creator.shippoApiToken}`,
      "Content-Type": "application/json",
    };

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

        // Push each order to Shippo
        for (const pledge of pledges) {
          try {
            const shippingAddress = pledge.surveyResponse?.shippingAddress;
            if (!shippingAddress) {
              results.failed++;
              results.errors.push(`Pledge ${pledge.id}: No shipping address`);
              continue;
            }

            // Build line items for order
            const lineItems = [];
            if (pledge.reward) {
              lineItems.push({
                title: pledge.reward.title,
                quantity: 1,
                sku: pledge.reward.sku || `REWARD-${pledge.reward.id}`,
                total_price: String(pledge.reward.price / 100),
                currency: "USD",
              });
            }

            for (const addonEntry of pledge.addons) {
              lineItems.push({
                title: addonEntry.addon.title,
                quantity: addonEntry.quantity,
                sku: addonEntry.addon.sku || `ADDON-${addonEntry.addon.id}`,
                total_price: String((addonEntry.addon.price * addonEntry.quantity) / 100),
                currency: "USD",
              });
            }

            // Create Shippo order
            const orderData = {
              order_number: `ICF-${pledge.id.substring(0, 8)}`,
              order_status: "PAID",
              to_address: {
                name: shippingAddress.name || pledge.user.name || "Unknown",
                street1: shippingAddress.line1,
                street2: shippingAddress.line2 || "",
                city: shippingAddress.city,
                state: shippingAddress.state,
                zip: shippingAddress.postalCode,
                country: shippingAddress.country,
                email: pledge.user.email,
              },
              line_items: lineItems,
              placed_at: pledge.createdAt.toISOString(),
              total_price: String(pledge.amount / 100),
              currency: "USD",
              notes: `IndieKit pledge from ${project.title}`,
            };

            const response = await circuitBreaker.execute("shippo", () =>
              fetch("https://api.goshippo.com/orders/", {
                method: "POST",
                headers: shippoHeaders,
                body: JSON.stringify(orderData),
              })
            );

            if (response.ok) {
              const result = await response.json();

              // Store Shippo order ID
              await db.pledge.update({
                where: { id: pledge.id },
                data: {
                  externalOrderId: result.object_id,
                  fulfillmentStatus: "IN_PROGRESS",
                },
              });

              results.pushed++;
            } else {
              const errorData = await response.json().catch(() => ({}));
              results.failed++;
              results.errors.push(`Pledge ${pledge.id}: ${JSON.stringify(errorData) || response.statusText}`);
            }
          } catch (error) {
            results.failed++;
            results.errors.push(`Pledge ${pledge.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }

        return NextResponse.json(results);
      }

      case "sync_tracking": {
        // Sync tracking information from Shippo
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
            // Get transactions (shipments) for this order
            const response = await circuitBreaker.execute("shippo", () =>
              fetch(
                `https://api.goshippo.com/orders/${pledge.externalOrderId}/`,
                { headers: shippoHeaders }
              )
            );

            if (response.ok) {
              const order = await response.json();
              if (order.transactions && order.transactions.length > 0) {
                // Get first transaction's tracking info
                const transactionId = order.transactions[0];
                const txResponse = await circuitBreaker.execute("shippo", () =>
                  fetch(
                    `https://api.goshippo.com/transactions/${transactionId}/`,
                    { headers: shippoHeaders }
                  )
                );

                if (txResponse.ok) {
                  const transaction = await txResponse.json();
                  if (transaction.tracking_number) {
                    await db.pledge.update({
                      where: { id: pledge.id },
                      data: {
                        trackingNumber: transaction.tracking_number,
                        fulfillmentStatus: "SHIPPED",
                      },
                    });
                    updated.push(pledge.id);
                  }
                }
              }
            }
          } catch {
            // Continue with other pledges
          }
        }

        return NextResponse.json({ synced: updated.length, pledgeIds: updated });
      }

      case "get_rates":
      case "create_shipment": {
        return NextResponse.json({ error: "Not yet implemented" }, { status: 501 });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    creatorIndiekitShippoLogger.error({ err: String(error) }, "Shippo API error:");
    return NextResponse.json({ error: "Failed to process Shippo request" }, { status: 500 });
  }
}
