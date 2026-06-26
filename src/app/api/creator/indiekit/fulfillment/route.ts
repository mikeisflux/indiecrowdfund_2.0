import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitFulfillmentLogger = logger.child({ module: "creator-indiekit-fulfillment" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/auth/collaborator";
import { maybeSendRatingRequest } from "@/lib/email/rating-request";

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

    // Fulfillment work requires canCoordinateFulfillment. Pre-perm
    // (legacy all-false) collaborators auto-pass; new restricted
    // collaborators (e.g. canManageCommunity-only) are blocked here so
    // they can't flip shipping status / push orders / mark refunds.
    const access = await getProjectAccess(projectId, session.user.id, "canCoordinateFulfillment");
    if (!access) {
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

      // State machine: only forward transitions allowed (NOT_STARTED ->
      // IN_PROGRESS -> SHIPPED -> DELIVERED). Without this gate a creator
      // could flip already-DELIVERED pledges back to NOT_STARTED to
      // re-export them, double-print packing slips, or back-date a
      // dispute. updateMany with a status-IN where-clause makes the
      // backward transitions land 0 rows; we report which pledges
      // actually moved.
      const rank: Record<string, number> = {
        NOT_STARTED: 0,
        IN_PROGRESS: 1,
        SHIPPED: 2,
        DELIVERED: 3,
      };
      const targetRank = rank[effectiveStatus];
      // Allowed source statuses are everything strictly less than the
      // target (so DELIVERED can come from any of NOT_STARTED /
      // IN_PROGRESS / SHIPPED; NOT_STARTED can't come from anything --
      // it's the initial state).
      const allowedFromStatuses = Object.entries(rank)
        .filter(([, r]) => r < targetRank)
        .map(([s]) => s);

      // Capture which pledges will actually move BEFORE the update, so
      // we know exactly which backers to nudge for a rating once they
      // hit DELIVERED (the updateMany only returns a count).
      const movingPledgeIds =
        effectiveStatus === "DELIVERED"
          ? (
              await db.pledge.findMany({
                where: {
                  id: { in: backerIds },
                  projectId,
                  deletedAt: null,
                  ...(allowedFromStatuses.length > 0
                    ? { fulfillmentStatus: { in: allowedFromStatuses as ("NOT_STARTED" | "IN_PROGRESS" | "SHIPPED" | "DELIVERED")[] } }
                    : { id: "__never__" }),
                },
                select: { id: true },
              })
            ).map((p: { id: string }) => p.id)
          : [];

      const updateResult = await db.pledge.updateMany({
        where: {
          id: { in: backerIds },
          projectId,
          deletedAt: null,
          ...(allowedFromStatuses.length > 0
            ? { fulfillmentStatus: { in: allowedFromStatuses as ("NOT_STARTED" | "IN_PROGRESS" | "SHIPPED" | "DELIVERED")[] } }
            : { id: "__never__" }), // NOT_STARTED has no valid source
        },
        data: {
          fulfillmentStatus: effectiveStatus,
        },
      });

      // Fire the rating-request nudge for every pledge that just hit
      // DELIVERED. Fire-and-forget so the creator's status update
      // returns instantly; maybeSendRatingRequest dedupes internally
      // so a re-mark never double-emails.
      if (movingPledgeIds.length > 0) {
        Promise.allSettled(
          movingPledgeIds.map((id: string) => maybeSendRatingRequest(id))
        ).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        updated: updateResult.count,
        skipped: backerIds.length - updateResult.count,
      });
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
