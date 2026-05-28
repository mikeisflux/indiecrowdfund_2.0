import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";

const creatorIndiekitStampsLogger = logger.child({ module: "creator-indiekit-stamps" });
import { db } from "@/lib/db";
import { z } from "zod";

const actionSchema = z.object({
  projectId: z.string(),
  action: z.enum(["push_orders", "sync_tracking", "get_rates", "create_label"]),
  backerIds: z.array(z.string()).optional(),
});

/**
 * Stamps.com API Integration
 * API Docs: https://developer.stamps.com/
 *
 * Note: Stamps.com uses a SOAP-based API with WSDL.
 * This implementation provides a basic REST-like wrapper.
 * Full integration would require a SOAP client library.
 */

// POST - Perform Stamps.com actions
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

    // Get PROJECT CREATOR's Stamps.com credentials
    // Collaborators use the creator's connection, not their own
    const creator = await db.user.findFirst({
      where: { id: project.creatorId, deletedAt: null },
      select: {
        stampsIntegrationId: true,
        stampsUsername: true,
        stampsPassword: true,
      },
    });

    if (!creator?.stampsIntegrationId || !creator?.stampsUsername || !creator?.stampsPassword) {
      return NextResponse.json(
        { error: "Stamps.com credentials not configured. The project creator must add their Integration ID, Username, and Password in Settings." },
        { status: 400 }
      );
    }

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

        // Stamps.com uses SOAP API - for now, we'll store orders locally
        // and mark them as ready for fulfillment
        // Full SOAP integration would require additional libraries
        for (const pledge of pledges) {
          try {
            const shippingAddress = pledge.surveyResponse?.shippingAddress;
            if (!shippingAddress) {
              results.failed++;
              results.errors.push(`Pledge ${pledge.id}: No shipping address`);
              continue;
            }

            // For now, just update the fulfillment status
            // Real implementation would call Stamps.com SOAP API
            await db.pledge.update({
              where: { id: pledge.id },
              data: {
                fulfillmentStatus: "IN_PROGRESS",
                externalOrderId: `STAMPS-${pledge.id.substring(0, 8)}`,
              },
            });

            results.pushed++;
          } catch (error) {
            results.failed++;
            results.errors.push(`Pledge ${pledge.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }

        // Add note about SOAP API
        if (results.pushed > 0) {
          results.errors.push("Note: Full Stamps.com SOAP API integration pending. Orders marked for fulfillment locally.");
        }

        return NextResponse.json(results);
      }

      case "sync_tracking": {
        // Stamps.com tracking sync would require SOAP API
        const pledgesWithOrders = await db.pledge.findMany({
          where: {
            projectId,
            externalOrderId: { startsWith: "STAMPS-" },
            fulfillmentStatus: { in: ["IN_PROGRESS", "PROCESSING"] },
          },
        });

        // For now, return the count of orders awaiting sync
        return NextResponse.json({
          synced: 0,
          pending: pledgesWithOrders.length,
          message: "Stamps.com tracking sync requires SOAP API integration",
        });
      }

      case "get_rates":
      case "create_label": {
        return NextResponse.json({
          error: "Stamps.com integration requires SOAP API. Please use the Stamps.com web interface for label creation.",
        }, { status: 501 });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    creatorIndiekitStampsLogger.error({ err: formatError(error) }, "Stamps.com API error:");
    return NextResponse.json({ error: "Failed to process Stamps.com request" }, { status: 500 });
  }
}
