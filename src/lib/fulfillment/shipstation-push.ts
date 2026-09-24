import { db } from "@/lib/db";
import { circuitBreaker } from "@/lib/circuit-breaker";
import { resolvePledgeShippingAddress } from "@/lib/fulfillment/shipping-address";
import {
  resolveShipStationCredentials,
} from "@/lib/fulfillment/shipstation-credentials";

// Shared ShipStation V1 order push.
//
// Extracted from /api/creator/indiekit/shipstation so the general
// fulfillment route (Packages tab group/bulk pushes) can run the same push
// as the explicit ShipStation route, instead of pretending with a
// { success: true } stub. See that route's header comment for the V1-vs-V2
// background.

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
export async function shipStationFetch(
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
export function getShipStationAuthHeader(apiKey: string, apiSecret: string): string {
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  return `Basic ${credentials}`;
}

export interface ShipStationPushResult {
  success: boolean;
  /** Set when the push could not start at all (e.g. not connected). */
  error?: string;
  pushed: number;
  failed: number;
  errors: string[];
  /**
   * Backers not attempted this call. Pacing for the 40/minute limit means a
   * long list cannot finish inside one request; the caller re-submits the
   * remainder rather than the run dying silently.
   */
  remaining: number;
}

/**
 * Push the given pledges to ShipStation as orders.
 *
 * Credentials come from the project's FulfillmentIntegration, falling back to
 * the creator's account-level keys. Successful pushes record the ShipStation
 * order id and move the pledge to IN_PROGRESS; failed ones are marked FAILED
 * so the Packages tab's "Push Errored" count and retry action reflect
 * reality (before FAILED existed, errors evaporated on the next page load).
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

  const pledges = await db.pledge.findMany({
    where: {
      id: { in: pledgeIds },
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

  const startedAt = Date.now();
  const failedPledgeIds: string[] = [];

  for (const [index, pledge] of pledges.entries()) {
    if (Date.now() - startedAt > PUSH_BUDGET_MS) {
      result.remaining = pledges.length - index;
      break;
    }
    try {
      const shippingAddress = resolvePledgeShippingAddress(
        pledge.surveyResponse?.shippingAddress,
        pledge.shippingAddress
      );
      if (!shippingAddress) {
        result.failed++;
        result.errors.push(`Pledge ${pledge.id}: No shipping address`);
        failedPledgeIds.push(pledge.id);
        continue;
      }

      // Build line items.
      //
      // Reward.amount is Decimal(10,2) in DOLLARS, and there is no `price`
      // or `sku` column on Reward — the SKUs here are generated, and match
      // what the SKU-mapping and customs (FulfillmentProduct) records use.
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
        internalNotes: `IndieCrowdfund · ${projectTitle} · Backer #${pledge.backerNumber || pledge.id}`,
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
        const created = await response.json();

        // Store ShipStation order ID
        await db.pledge.update({
          where: { id: pledge.id },
          data: {
            externalOrderId: String(created.orderId),
            fulfillmentStatus: "IN_PROGRESS",
          },
        });

        result.pushed++;
      } else {
        const errorData = await response.json().catch(() => ({}));
        result.failed++;
        result.errors.push(`Pledge ${pledge.id}: ${errorData.Message || response.statusText}`);
        failedPledgeIds.push(pledge.id);
      }
    } catch (error) {
      result.failed++;
      result.errors.push(`Pledge ${pledge.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      failedPledgeIds.push(pledge.id);
    }
  }

  // Record failures so "Push Errored" and retry_errored have something real
  // to work from. Only pledges still awaiting a push are marked — never
  // downgrade one that's already IN_PROGRESS/SHIPPED from an earlier push.
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

  // Keep the integration's running stats honest (they feed the Integrations
  // tab). Best-effort: a stats miss must not fail a successful push.
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
