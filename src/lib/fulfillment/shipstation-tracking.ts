import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { circuitBreaker } from "@/lib/circuit-breaker";
import { resolveShipStationCredentials } from "@/lib/fulfillment/shipstation-credentials";

const log = logger.child({ module: "shipstation-tracking" });

/**
 * Pull tracking numbers back from ShipStation onto pledges.
 *
 * Lives here rather than inside the route because two callers need it and
 * only one of them has a session: the creator pressing Sync tracking, and the
 * unattended cron. The route used to own this logic outright, which is part of
 * why nothing ever ran it on a schedule.
 */

// V1 allows 40 requests per minute per key pair. Pacing keeps a long sync from
// walking into a wall of 429s halfway down the list and reporting them as
// failures.
const V1_MIN_GAP_MS = 1_600;
const DEFAULT_BUDGET_MS = 45_000;

let lastCallAt = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function shipStationFetch(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  const since = Date.now() - lastCallAt;
  if (since < V1_MIN_GAP_MS) await sleep(V1_MIN_GAP_MS - since);
  lastCallAt = Date.now();

  const response = await circuitBreaker.execute("shipstation", () => fetch(url, init));

  if (response.status === 429 && attempt < 2) {
    // V1 sends X-Rate-Limit-Reset rather than Retry-After, so generic retry
    // logic misses it. Capped so a malformed header cannot park the request.
    const reset = Number(response.headers.get("X-Rate-Limit-Reset") || "0");
    await sleep(Math.min(Math.max(reset, 1) * 1000, 20_000));
    return shipStationFetch(url, init, attempt + 1);
  }
  return response;
}

export interface ShipStationTrackingResult {
  success: boolean;
  synced: number;
  /** Not looked at this run because the time budget ran out. */
  remaining: number;
  pledgeIds: string[];
  error?: string;
}

export async function syncShipStationTracking(
  projectId: string,
  creatorId: string,
  budgetMs: number = DEFAULT_BUDGET_MS
): Promise<ShipStationTrackingResult> {
  const credentials = await resolveShipStationCredentials(projectId, creatorId);
  if (!credentials) {
    return {
      success: false,
      synced: 0,
      remaining: 0,
      pledgeIds: [],
      error: "ShipStation isn't connected for this campaign.",
    };
  }

  const authHeader =
    "Basic " +
    Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString("base64");

  // Prisma 7 rejects `{ field: { not: null } }` on nullable string fields at
  // runtime — the `NOT: { field: null }` wrapper is the working form.
  const pledges = await db.pledge.findMany({
    where: {
      projectId,
      NOT: { externalOrderId: null },
      fulfillmentStatus: { in: ["IN_PROGRESS", "PROCESSING"] },
    },
    select: { id: true, externalOrderId: true },
  });

  const updated: string[] = [];
  let remaining = 0;
  const startedAt = Date.now();

  for (const [index, pledge] of pledges.entries()) {
    if (Date.now() - startedAt > budgetMs) {
      remaining = pledges.length - index;
      break;
    }
    try {
      // Tracking comes from the shipments endpoint. A V1 order object carries
      // no shipments array, so reading it off the order — as this once did —
      // never found anything and nothing was ever marked shipped.
      const response = await shipStationFetch(
        `https://ssapi.shipstation.com/shipments?orderId=${encodeURIComponent(
          String(pledge.externalOrderId)
        )}`,
        { headers: { Authorization: authHeader } }
      );
      if (!response.ok) continue;

      const body = await response.json();
      // Voided shipments come back by default. Treating one as shipped would
      // tell a backer their parcel is moving when the label was cancelled.
      const shipment = (body.shipments || []).find(
        (s: { voided?: boolean; trackingNumber?: string | null }) => !s.voided && s.trackingNumber
      );
      if (!shipment) continue;

      await db.pledge.update({
        where: { id: pledge.id },
        data: { trackingNumber: shipment.trackingNumber, fulfillmentStatus: "SHIPPED" },
      });
      updated.push(pledge.id);
    } catch (error) {
      // One bad order must not end the run for the rest.
      log.warn({ err: formatError(error), pledgeId: pledge.id }, "Tracking lookup failed");
    }
  }

  log.info({ projectId, synced: updated.length, remaining }, "ShipStation tracking sync complete");

  return { success: true, synced: updated.length, remaining, pledgeIds: updated };
}
