import { db } from "@/lib/db";
import { resolvePledgeShippingAddress } from "@/lib/fulfillment/shipping-address";
import { resolveShipStationCredentials } from "@/lib/fulfillment/shipstation-credentials";
import {
  shipStationFetch,
  getShipStationAuthHeader,
  CircuitOpenError,
} from "@/lib/fulfillment/shipstation-client";
import {
  buildShipStationOrder,
  parseShipStationError,
  rewardSku,
  addonSku,
  toOunces,
  type ShipStationProductInfo,
} from "@/lib/fulfillment/shipstation-order";

// Shared ShipStation V1 order push, used by the explicit ShipStation route,
// the Packages tab's group/bulk pushes (fulfillment route) and the Backers
// tab (backers route). The payload itself is built by the pure
// buildShipStationOrder so it can be exercised without a database.

export { shipStationFetch, getShipStationAuthHeader };

// Server-side budget for one bulk push. Past this the handler returns what it
// managed and tells the caller how many are left.
const PUSH_BUDGET_MS = 45_000;

export interface ShipStationPushResult {
  success: boolean;
  /** Set when the push could not start at all (e.g. not connected). */
  error?: string;
  pushed: number;
  failed: number;
  /** Pledges not eligible (already shipped, not paid, deleted) — left untouched. */
  skipped: number;
  errors: string[];
  /**
   * Backers not attempted this call (time budget, rate limit, or a tripped
   * circuit breaker). The caller re-submits the remainder.
   */
  remaining: number;
}

/**
 * Push the given pledges to ShipStation as orders.
 *
 * Only paid, unshipped pledges are sent: the Backers tab's select-all used to
 * re-push SHIPPED/DELIVERED (and refunded) orders, which the orderKey upsert
 * then rewrote back to "awaiting_shipment" and reset locally to IN_PROGRESS.
 * Weights and customs come from the Products tab (FulfillmentProduct rows
 * keyed by the generated SKUs); without them ShipStation orders arrived
 * weightless and international orders had no declaration.
 */
export async function pushPledgesToShipStation(opts: {
  projectId: string;
  creatorId: string;
  projectTitle: string;
  pledgeIds: string[];
}): Promise<ShipStationPushResult> {
  const { projectId, creatorId, projectTitle, pledgeIds } = opts;

  const result: ShipStationPushResult = {
    success: true,
    pushed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    remaining: 0,
  };

  if (pledgeIds.length === 0) return result;

  const credentials = await resolveShipStationCredentials(projectId, creatorId);
  if (!credentials) {
    return {
      ...result,
      success: false,
      error:
        "ShipStation isn't connected for this campaign. The creator or an accepted collaborator can connect it in IndieKit under Settings > Integrations.",
    };
  }

  const authHeader = getShipStationAuthHeader(credentials.apiKey, credentials.apiSecret);

  const requested = await db.pledge.findMany({
    where: { id: { in: pledgeIds }, projectId, deletedAt: null },
    include: {
      user: { select: { email: true, name: true } },
      surveyResponse: true,
      reward: true,
      addons: { include: { addon: true } },
    },
  });

  // Eligibility: paid (COMPLETED, or a counted saved-card pledge on a funded
  // campaign) and not already shipped.
  const pledges = requested.filter((p) => {
    const paid = p.status === "COMPLETED" || (p.status === "PENDING" && p.confirmationEmailSent);
    const unshipped = p.fulfillmentStatus === "NOT_STARTED" || p.fulfillmentStatus === "FAILED" || p.fulfillmentStatus === "IN_PROGRESS";
    return paid && unshipped;
  });
  result.skipped = pledgeIds.length - pledges.length;

  // Weight + customs for every SKU this batch touches, one query.
  const skus = new Set<string>();
  for (const p of pledges) {
    if (p.reward) skus.add(rewardSku(p.reward.id));
    for (const a of p.addons) skus.add(addonSku(a.addon.id));
  }
  const products = new Map<string, ShipStationProductInfo>();
  if (skus.size > 0) {
    const rows = await db.fulfillmentProduct.findMany({
      where: { projectId, sku: { in: [...skus] } },
      select: {
        sku: true,
        weight: true,
        weightUnit: true,
        customsCode: true,
        customsDescription: true,
        countryOfOrigin: true,
        declaredValue: true,
      },
    });
    for (const r of rows) {
      products.set(r.sku, {
        weightOz: toOunces(r.weight, r.weightUnit),
        customsCode: r.customsCode,
        customsDescription: r.customsDescription,
        countryOfOrigin: r.countryOfOrigin,
        declaredValue: r.declaredValue == null ? null : Number(r.declaredValue),
      });
    }
  }

  const startedAt = Date.now();
  const failedPledgeIds: string[] = [];

  for (const [index, pledge] of pledges.entries()) {
    if (Date.now() - startedAt > PUSH_BUDGET_MS) {
      result.remaining = pledges.length - index;
      break;
    }

    const label = pledge.backerNumber ? `Backer #${pledge.backerNumber}` : `Pledge ${pledge.id}`;
    const build = buildShipStationOrder({
      pledgeId: pledge.id,
      backerNumber: pledge.backerNumber,
      createdAt: pledge.createdAt,
      amount: Number(pledge.amount),
      email: pledge.user.email,
      backerName: pledge.user.name,
      address: resolvePledgeShippingAddress(pledge.surveyResponse?.shippingAddress, pledge.shippingAddress),
      reward: pledge.reward
        ? { id: pledge.reward.id, title: pledge.reward.title, amount: Number(pledge.reward.amount) }
        : null,
      addons: pledge.addons.map((a: { addon: { id: string; title: string; amount: unknown }; quantity: number }) => ({
        id: a.addon.id,
        title: a.addon.title,
        amount: Number(a.addon.amount),
        quantity: a.quantity,
      })),
      products,
      projectTitle,
      storeId: credentials.storeId,
    });

    if (!build.ok) {
      result.failed++;
      result.errors.push(`${label}: ${build.error}`);
      failedPledgeIds.push(pledge.id);
      continue;
    }

    try {
      const response = await shipStationFetch("/orders/createorder", {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(build.order),
      });

      if (response.status === 429) {
        // Retries exhausted inside shipStationFetch. That's "come back in a
        // minute", not a failed backer — report the rest as remaining.
        result.remaining = pledges.length - index;
        result.errors.push("ShipStation rate limit reached — push again in a minute to continue");
        break;
      }

      if (response.status === 401 || response.status === 403) {
        result.remaining = pledges.length - index;
        result.errors.push(parseShipStationError(await response.json().catch(() => null), response.status));
        await db.fulfillmentIntegration
          .updateMany({
            where: { projectId, provider: "SHIPSTATION" },
            data: { status: "ERROR", lastSyncError: "ShipStation rejected the API credentials — reconnect" },
          })
          .catch(() => {});
        break;
      }

      if (response.ok) {
        const created = await response.json();
        await db.pledge.update({
          where: { id: pledge.id },
          data: { externalOrderId: String(created.orderId), fulfillmentStatus: "IN_PROGRESS" },
        });
        result.pushed++;
      } else {
        const body = await response.json().catch(() => null);
        result.failed++;
        result.errors.push(`${label}: ${parseShipStationError(body, response.status)}`);
        failedPledgeIds.push(pledge.id);
      }
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        // ShipStation is unreachable right now; nothing after this point
        // would succeed either. Not a per-backer failure.
        result.remaining = pledges.length - index;
        result.errors.push("ShipStation is unreachable at the moment — push again shortly");
        break;
      }
      result.failed++;
      result.errors.push(`${label}: ${error instanceof Error ? error.message : "Unknown error"}`);
      failedPledgeIds.push(pledge.id);
    }
  }

  // Record failures so "Push Errored" and retry_errored have something real
  // to work from. Never downgrade one that's already IN_PROGRESS/SHIPPED.
  if (failedPledgeIds.length > 0) {
    await db.pledge
      .updateMany({
        where: {
          id: { in: failedPledgeIds },
          projectId,
          fulfillmentStatus: { in: ["NOT_STARTED", "FAILED"] },
        },
        data: { fulfillmentStatus: "FAILED" },
      })
      .catch(() => {});
  }

  if (result.pushed > 0 || result.failed > 0) {
    await db.fulfillmentIntegration
      .updateMany({
        where: { projectId, provider: "SHIPSTATION" },
        data: {
          ordersPushed: { increment: result.pushed },
          ordersFailed: { increment: result.failed },
          lastSyncAt: new Date(),
        },
      })
      .catch(() => {});
  }

  return result;
}
