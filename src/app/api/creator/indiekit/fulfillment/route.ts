import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitFulfillmentLogger = logger.child({ module: "creator-indiekit-fulfillment" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/auth/collaborator";
import { maybeSendRatingRequest } from "@/lib/email/rating-request";
import { pushPledgesToShipStation } from "@/lib/fulfillment/shipstation-push";
import { syncShipStationTracking } from "@/lib/fulfillment/shipstation-tracking";
import { resolvePledgeShippingAddress } from "@/lib/fulfillment/shipping-address";

// Fulfillment actions for the IndieKit Packages tab.
//
// This route used to implement update_status / mark_shipped and let every
// other action (push_orders, push_all, retry_errored, sync_status, export,
// update_customs) fall through to `{ success: true }` — the UI showed
// "Pushed 0 orders" style success toasts while nothing at all happened.
// Every action below now either does the work or returns a real error.

type FulfillmentStatusValue = "NOT_STARTED" | "IN_PROGRESS" | "SHIPPED" | "DELIVERED" | "FAILED";

/**
 * Pledges eligible for a push: paid, not deleted, and awaiting their first
 * successful push (NOT_STARTED, or FAILED from an earlier attempt when
 * includeFailed is set). groupName narrows to one package group — groups are
 * generated per reward tier, so the group's name IS the reward title
 * ("No Reward" for pledges without one).
 */
async function findPushCandidates(opts: {
  projectId: string;
  groupName?: string;
  includeFailed?: boolean;
  onlyFailed?: boolean;
}) {
  const { projectId, groupName, includeFailed, onlyFailed } = opts;
  const statuses: FulfillmentStatusValue[] = onlyFailed
    ? ["FAILED"]
    : includeFailed
      ? ["NOT_STARTED", "FAILED"]
      : ["NOT_STARTED"];

  return db.pledge.findMany({
    where: {
      projectId,
      deletedAt: null,
      status: "COMPLETED",
      fulfillmentStatus: { in: statuses },
      ...(groupName
        ? groupName === "No Reward"
          ? { rewardId: null }
          : { reward: { title: groupName } }
        : {}),
    },
    select: {
      id: true,
      surveyCompleted: true,
      shippingAddress: true,
      surveyResponse: { select: { isComplete: true, shippingAddress: true } },
    },
  });
}

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

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

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, title: true, creatorId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
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
      // actually moved. FAILED (a push that errored) ranks with
      // NOT_STARTED: it can move forward to anything, nothing moves
      // "back" into it by hand.
      const rank: Record<string, number> = {
        NOT_STARTED: 0,
        FAILED: 0,
        IN_PROGRESS: 1,
        SHIPPED: 2,
        DELIVERED: 3,
      };
      const targetRank = rank[effectiveStatus];
      // Allowed source statuses are everything strictly less than the
      // target (so DELIVERED can come from any of NOT_STARTED / FAILED /
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
                    ? { fulfillmentStatus: { in: allowedFromStatuses as FulfillmentStatusValue[] } }
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
            ? { fulfillmentStatus: { in: allowedFromStatuses as FulfillmentStatusValue[] } }
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

    // Push one package group's not-pushed orders (or an explicit pledge-id
    // list) to ShipStation. Shopify pushes go through the shopify route.
    if (action === "push_orders" || action === "push_all" || action === "retry_errored") {
      let pledgeIds: string[];

      if (action === "push_orders" && Array.isArray(backerIds) && backerIds.length > 0) {
        pledgeIds = backerIds;
      } else {
        const candidates = await findPushCandidates({
          projectId,
          groupName: action === "push_orders" ? body.groupName : undefined,
          onlyFailed: action === "retry_errored",
        });

        // push_all's segment filter mirrors the dropdown on the tab.
        const segment: string = action === "push_all" ? body.segment || "all" : "all";
        pledgeIds = candidates
          .filter((p) => {
            if (segment === "all" || segment === "payment_complete") return true;
            const surveyComplete = p.surveyResponse?.isComplete || p.surveyCompleted === true;
            const address = resolvePledgeShippingAddress(
              p.surveyResponse?.shippingAddress,
              p.shippingAddress
            );
            const addressComplete = !!(address?.line1 && address?.city && address?.country && address?.postalCode);
            if (segment === "survey_complete") return surveyComplete;
            if (segment === "address_complete") return addressComplete;
            // ready_to_ship (the default filter)
            return surveyComplete && addressComplete;
          })
          .map((p) => p.id);
      }

      if (pledgeIds.length === 0) {
        return NextResponse.json({
          success: true,
          pushed: 0,
          count: 0,
          failed: 0,
          errors: [],
          message:
            action === "retry_errored"
              ? "No errored orders to retry"
              : "No orders awaiting push match this selection",
        });
      }

      const result = await pushPledgesToShipStation({
        projectId,
        creatorId: project.creatorId,
        projectTitle: project.title,
        pledgeIds,
      });
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        pushed: result.pushed,
        count: result.pushed,
        failed: result.failed,
        errors: result.errors,
        remaining: result.remaining,
      });
    }

    // Pull shipment/tracking state back from ShipStation. (Shopify status
    // syncs go through the shopify route's sync_status.)
    if (action === "sync_status") {
      const result = await syncShipStationTracking(projectId, project.creatorId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        updated: result.synced,
        remaining: result.remaining,
      });
    }

    // CSV export of a package group's orders (or the whole campaign's).
    // "excel" gets the same CSV — Excel opens it directly — under an .csv
    // name; there is no real XLSX writer here and pretending otherwise is
    // how this tab got audited in the first place.
    if (action === "export") {
      const format: string = body.format || "csv";
      if (format === "packing_slips" || format === "shipping_labels") {
        return NextResponse.json(
          {
            error:
              format === "packing_slips"
                ? "Packing slips are printed from the Backers tab (select backers > Packing Slips) — a bulk file export isn't available yet."
                : "Shipping label export isn't available yet — labels are generated by your connected shipping service.",
          },
          { status: 501 }
        );
      }

      const groupName: string | undefined = body.groupName || undefined;
      const pledges = await db.pledge.findMany({
        where: {
          projectId,
          deletedAt: null,
          status: "COMPLETED",
          ...(groupName
            ? groupName === "No Reward"
              ? { rewardId: null }
              : { reward: { title: groupName } }
            : {}),
        },
        orderBy: { backerNumber: "asc" },
        select: {
          id: true,
          backerNumber: true,
          amount: true,
          fulfillmentStatus: true,
          trackingNumber: true,
          shippingAddress: true,
          user: { select: { name: true, email: true } },
          reward: { select: { title: true } },
          surveyResponse: { select: { shippingAddress: true } },
          addons: { select: { quantity: true, addon: { select: { title: true } } } },
        },
      });

      const header = [
        "Backer #", "Name", "Email", "Reward", "Add-ons", "Amount",
        "Fulfillment Status", "Tracking #", "Ship To Name", "Address 1",
        "Address 2", "City", "State", "Postal Code", "Country", "Phone",
      ];
      const rows = pledges.map((p) => {
        const address = resolvePledgeShippingAddress(
          p.surveyResponse?.shippingAddress,
          p.shippingAddress
        );
        const addonsList = p.addons
          .map((a: { quantity: number; addon: { title: string } }) =>
            a.quantity > 1 ? `${a.addon.title} x${a.quantity}` : a.addon.title
          )
          .join("; ");
        return [
          p.backerNumber ?? "", p.user.name ?? "", p.user.email ?? "",
          p.reward?.title ?? "No Reward", addonsList, Number(p.amount).toFixed(2),
          p.fulfillmentStatus ?? "NOT_STARTED", p.trackingNumber ?? "",
          address?.name ?? "", address?.line1 ?? "", address?.line2 ?? "",
          address?.city ?? "", address?.state ?? "", address?.postalCode ?? "",
          address?.country ?? "", address?.phone ?? "",
        ];
      });
      const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
      const slug = (groupName || "all-orders").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return NextResponse.json({
        success: true,
        filename: `orders-${slug || "export"}-${new Date().toISOString().slice(0, 10)}.csv`,
        csv,
        count: rows.length,
      });
    }

    // Customs / weight details for one package-group item. Groups are
    // generated per reward tier, so the item persists as a
    // FulfillmentProduct keyed by the reward's generated SKU — the same SKU
    // the ShipStation push writes on order line items.
    if (action === "update_customs") {
      const itemName: string | undefined = body.itemName;
      const customs = (body.customs ?? {}) as {
        description?: string;
        value?: number;
        countryOfOrigin?: string;
        customsCode?: string;
        weightOz?: number;
      };
      if (!itemName) {
        return NextResponse.json({ error: "Item name required" }, { status: 400 });
      }

      const reward = await db.reward.findFirst({
        where: { projectId, title: itemName },
        select: { id: true, title: true },
      });
      if (!reward) {
        return NextResponse.json(
          { error: `No reward named "${itemName}" on this campaign` },
          { status: 404 }
        );
      }

      const sku = `REWARD-${reward.id}`;
      const weightOz =
        typeof customs.weightOz === "number" && customs.weightOz > 0 ? customs.weightOz : null;
      const hasCustoms = !!(customs.description?.trim() && customs.countryOfOrigin?.trim());
      const data = {
        name: reward.title,
        customsDescription: customs.description?.trim() || null,
        declaredValue:
          typeof customs.value === "number" && customs.value > 0 ? customs.value : null,
        countryOfOrigin: customs.countryOfOrigin?.trim() || null,
        customsCode: customs.customsCode?.trim() || null,
        ...(weightOz !== null ? { weight: weightOz, weightUnit: "oz" } : {}),
        status: (weightOz !== null && hasCustoms
          ? "READY"
          : hasCustoms
            ? "NO_WEIGHT"
            : "NO_CUSTOMS") as "READY" | "NO_WEIGHT" | "NO_CUSTOMS",
      };

      const existing = await db.fulfillmentProduct.findFirst({
        where: { projectId, sku },
        select: { id: true, weight: true },
      });
      if (existing) {
        await db.fulfillmentProduct.update({
          where: { id: existing.id },
          data: {
            ...data,
            // A weight saved earlier survives a customs-only edit.
            status:
              data.status === "NO_WEIGHT" && existing.weight ? "READY" : data.status,
          },
        });
      } else {
        await db.fulfillmentProduct.create({
          data: { projectId, sku, type: "PHYSICAL", ...data },
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === "create_group") {
      return NextResponse.json(
        {
          error:
            "Package groups are generated automatically from your reward tiers — custom groups aren't supported.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    creatorIndiekitFulfillmentLogger.error({ err: formatError(error) }, "Fulfillment API error:");
    return NextResponse.json({ error: "Failed to process fulfillment request" }, { status: 500 });
  }
}
