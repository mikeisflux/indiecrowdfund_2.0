import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const actionSchema = z.object({
  projectId: z.string(),
  action: z.enum(["push_orders", "sync_tracking", "get_rates", "create_shipment"]),
  backerIds: z.array(z.string()).optional(),
});

/**
 * EasyPost API Integration
 * API Docs: https://www.easypost.com/docs/api
 */

// POST - Perform EasyPost actions
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action, backerIds } = actionSchema.parse(body);

    // Get user's EasyPost credentials
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        easypostApiKey: true,
      },
    });

    if (!user?.easypostApiKey) {
      return NextResponse.json(
        { error: "EasyPost credentials not configured. Please add your API Key in Settings." },
        { status: 400 }
      );
    }

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
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    const easypostAuth = Buffer.from(`${user.easypostApiKey}:`).toString("base64");
    const easypostHeaders = {
      "Authorization": `Basic ${easypostAuth}`,
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

        // EasyPost works with shipments rather than orders
        // We'll create addresses for each pledge and store them for later shipment creation
        for (const pledge of pledges) {
          try {
            const shippingAddress = pledge.surveyResponse?.shippingAddress;
            if (!shippingAddress) {
              results.failed++;
              results.errors.push(`Pledge ${pledge.id}: No shipping address`);
              continue;
            }

            // Create EasyPost address for this recipient
            const addressData = {
              address: {
                name: shippingAddress.name || pledge.user.name || "Unknown",
                street1: shippingAddress.line1,
                street2: shippingAddress.line2 || "",
                city: shippingAddress.city,
                state: shippingAddress.state,
                zip: shippingAddress.postalCode,
                country: shippingAddress.country,
                email: pledge.user.email,
              },
            };

            const response = await fetch("https://api.easypost.com/v2/addresses", {
              method: "POST",
              headers: easypostHeaders,
              body: JSON.stringify(addressData),
            });

            if (response.ok) {
              const result = await response.json();

              // Store EasyPost address ID for later shipment creation
              await db.pledge.update({
                where: { id: pledge.id },
                data: {
                  externalOrderId: result.id, // Store address ID as external order ID
                  fulfillmentStatus: "IN_PROGRESS",
                },
              });

              results.pushed++;
            } else {
              const errorData = await response.json().catch(() => ({}));
              results.failed++;
              results.errors.push(`Pledge ${pledge.id}: ${errorData.error?.message || response.statusText}`);
            }
          } catch (error) {
            results.failed++;
            results.errors.push(`Pledge ${pledge.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }

        return NextResponse.json(results);
      }

      case "sync_tracking": {
        // Sync tracking information from EasyPost
        const pledgesWithOrders = await db.pledge.findMany({
          where: {
            projectId,
            trackingNumber: { not: null },
            fulfillmentStatus: { in: ["IN_PROGRESS", "PROCESSING", "SHIPPED"] },
          },
        });

        const updated = [];
        for (const pledge of pledgesWithOrders) {
          try {
            // Get tracker for this tracking number
            const response = await fetch(
              `https://api.easypost.com/v2/trackers?tracking_code=${pledge.trackingNumber}`,
              { headers: easypostHeaders }
            );

            if (response.ok) {
              const data = await response.json();
              if (data.trackers && data.trackers.length > 0) {
                const tracker = data.trackers[0];
                if (tracker.status === "delivered") {
                  await db.pledge.update({
                    where: { id: pledge.id },
                    data: {
                      fulfillmentStatus: "DELIVERED",
                    },
                  });
                  updated.push(pledge.id);
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
    console.error("EasyPost API error:", error);
    return NextResponse.json({ error: "Failed to process EasyPost request" }, { status: 500 });
  }
}
