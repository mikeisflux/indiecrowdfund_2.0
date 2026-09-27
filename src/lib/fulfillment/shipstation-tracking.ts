import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { resolveShipStationCredentials } from "@/lib/fulfillment/shipstation-credentials";
import { shipStationFetch, getShipStationAuthHeader, CircuitOpenError } from "@/lib/fulfillment/shipstation-client";
import { parseShipStationError } from "@/lib/fulfillment/shipstation-order";
import { normalizeCarrier } from "@/lib/fulfillment/tracking-url";

const log = logger.child({ module: "shipstation-tracking" });

/**
 * Pull tracking numbers back from ShipStation onto pledges.
 *
 * Two callers: the creator pressing Sync, and the half-hourly cron. Tracking
 * lives on ShipStation's shipments, not its orders, so this pages through
 * GET /shipments for the account (a couple of requests) and matches on
 * orderId — the previous one-request-per-order loop covered ~28 orders per
 * click and hid everything it hadn't reached.
 */

const MAX_PAGES = 10;
const PAGE_SIZE = 500;

export interface ShipStationTrackingResult {
  success: boolean;
  synced: number;
  /** Open orders that ShipStation hasn't shipped yet (informational). */
  remaining: number;
  pledgeIds: string[];
  error?: string;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function syncShipStationTracking(
  projectId: string,
  creatorId: string
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

  const authHeader = getShipStationAuthHeader(credentials.apiKey, credentials.apiSecret);

  // IN_PROGRESS = pushed, awaiting a shipment. (An earlier version also
  // listed a "PROCESSING" status that doesn't exist in the enum — Prisma
  // rejected the whole query, so this sync never ran successfully.)
  const open = await db.pledge.findMany({
    where: {
      projectId,
      deletedAt: null,
      NOT: { externalOrderId: null },
      fulfillmentStatus: "IN_PROGRESS",
    },
    select: { id: true, externalOrderId: true },
  });
  if (open.length === 0) {
    return { success: true, synced: 0, remaining: 0, pledgeIds: [] };
  }
  const pledgeByOrderId = new Map(open.map((p) => [String(p.externalOrderId), p.id]));

  // Look back far enough to cover a slow warehouse; ShipStation filters by
  // ship date, so a 120-day window is cheap.
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  const updated: string[] = [];

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const qs = new URLSearchParams({
        shipDateStart: ymd(since),
        includeShipmentItems: "false",
        pageSize: String(PAGE_SIZE),
        page: String(page),
        ...(credentials.storeId ? { storeId: String(credentials.storeId) } : {}),
      });
      const response = await shipStationFetch(`/shipments?${qs.toString()}`, {
        headers: { Authorization: authHeader },
      });

      if (response.status === 401 || response.status === 403) {
        // Rotated or revoked keys. Say so and flag the integration so the
        // tile shows Reconnect — "Synced 0" hid this completely.
        const message = "ShipStation rejected the API credentials — reconnect under Settings → Integrations";
        await db.fulfillmentIntegration
          .updateMany({ where: { projectId, provider: "SHIPSTATION" }, data: { status: "ERROR", lastSyncError: message } })
          .catch(() => {});
        return { success: false, synced: updated.length, remaining: open.length - updated.length, pledgeIds: updated, error: message };
      }
      if (!response.ok) {
        const message = parseShipStationError(await response.json().catch(() => null), response.status);
        return { success: false, synced: updated.length, remaining: open.length - updated.length, pledgeIds: updated, error: message };
      }

      const body = (await response.json()) as {
        shipments?: Array<{
          orderId?: number | string;
          trackingNumber?: string | null;
          carrierCode?: string | null;
          voided?: boolean;
        }>;
        pages?: number;
      };

      for (const s of body.shipments || []) {
        // Voided shipments come back too; a cancelled label is not a shipment.
        if (s.voided || !s.trackingNumber) continue;
        const pledgeId = pledgeByOrderId.get(String(s.orderId));
        if (!pledgeId || updated.includes(pledgeId)) continue;

        const carrierCode = s.carrierCode ?? null;
        const carrier = normalizeCarrier(carrierCode);
        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            trackingNumber: s.trackingNumber,
            trackingCarrier: carrierCode,
            trackingUrl: carrier ? carrier.url(encodeURIComponent(String(s.trackingNumber))) : null,
            fulfillmentStatus: "SHIPPED",
          },
        });
        updated.push(pledgeId);
      }

      if (!body.pages || page >= body.pages) break;
      if (updated.length >= open.length) break;
    }
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      return { success: false, synced: updated.length, remaining: open.length - updated.length, pledgeIds: updated, error: "ShipStation is unreachable at the moment — try again shortly" };
    }
    log.warn({ err: formatError(error), projectId }, "Tracking sync failed");
    return { success: false, synced: updated.length, remaining: open.length - updated.length, pledgeIds: updated, error: "Tracking sync failed — see server logs" };
  }

  if (updated.length > 0) {
    await db.fulfillmentIntegration
      .updateMany({
        where: { projectId, provider: "SHIPSTATION" },
        data: { ordersShipped: { increment: updated.length }, lastSyncAt: new Date(), lastSyncError: null },
      })
      .catch(() => {});
  }

  log.info({ projectId, synced: updated.length, stillOpen: open.length - updated.length }, "ShipStation tracking sync complete");
  return { success: true, synced: updated.length, remaining: open.length - updated.length, pledgeIds: updated };
}
