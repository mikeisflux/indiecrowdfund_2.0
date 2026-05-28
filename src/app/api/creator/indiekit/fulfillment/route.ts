import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitFulfillmentLogger = logger.child({ module: "creator-indiekit-fulfillment" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action, backerIds, status } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    if (action === "update_status") {
      if (!backerIds || !Array.isArray(backerIds) || backerIds.length === 0) {
        return NextResponse.json({ error: "Backer IDs required" }, { status: 400 });
      }

      const validStatuses = ["NOT_STARTED", "IN_PROGRESS", "SHIPPED", "DELIVERED"];
      const effectiveStatus = status || "IN_PROGRESS";
      if (!validStatuses.includes(effectiveStatus)) {
        return NextResponse.json({ error: "Invalid fulfillment status" }, { status: 400 });
      }

      // Update fulfillment status for pledges
      await db.pledge.updateMany({
        where: {
          id: { in: backerIds },
          projectId,
          deletedAt: null,
        },
        data: {
          fulfillmentStatus: effectiveStatus,
        },
      });

      return NextResponse.json({ success: true, updated: backerIds.length });
    }

    if (action === "push_to_provider") {
      // Stub - would integrate with fulfillment providers
      return NextResponse.json({ success: true, message: "Orders queued for fulfillment" });
    }

    if (action === "mark_shipped") {
      if (!backerIds || !Array.isArray(backerIds)) {
        return NextResponse.json({ error: "Backer IDs required" }, { status: 400 });
      }

      await db.pledge.updateMany({
        where: {
          id: { in: backerIds },
          projectId,
          deletedAt: null,
        },
        data: {
          fulfillmentStatus: "SHIPPED",
        },
      });

      return NextResponse.json({ success: true, shipped: backerIds.length });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorIndiekitFulfillmentLogger.error({ err: formatError(error) }, "Fulfillment API error:");
    return NextResponse.json({ error: "Failed to process fulfillment request" }, { status: 500 });
  }
}
