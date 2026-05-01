import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { loadPrintingComicsConfig } from "@/lib/printingcomics/config";
import {
  verifyPrintingComicsWebhook,
  type PCWebhookEvent,
} from "@/lib/printingcomics/webhook";

const log = logger.child({ module: "printingcomics-webhook" });

export const dynamic = "force-dynamic";

// Ack-first webhook receiver for Printing Comics order.* events.
// Provider headers (per docs):
//   X-PC-Event:     order.created | order.paid | order.in_production |
//                   order.shipped | order.delivered | order.cancelled |
//                   order.refunded
//   X-PC-Signature: t=<unix>,v1=<hmac-sha256-of-${t}.${rawBody}>
// They time out after 8s and store non-2xx responses for manual replay.
//
// We resolve the inbound event back to a Pledge using one of two keys
// depending on what the provider includes in the payload:
//   - data.order.externalRef   (we set this to pledge.id on submit)
//   - data.order.id            (saved on Pledge.printingComicsOrderId
//                               after the create-order response)

interface PCWebhookPayload {
  event?: PCWebhookEvent;
  data?: {
    order?: {
      id?: string;
      number?: string;
      externalRef?: string;
      status?: string;
      paymentStatus?: string;
      shippingMethod?: string;
      trackingNumber?: string;
    };
  };
}

const STATUS_MAP: Record<PCWebhookEvent, string> = {
  "order.created": "PENDING",
  "order.paid": "PAID",
  "order.in_production": "IN_PRODUCTION",
  "order.shipped": "SHIPPED",
  "order.delivered": "DELIVERED",
  "order.cancelled": "CANCELLED",
  "order.refunded": "REFUNDED",
};

export async function POST(req: NextRequest) {
  // Read raw body BEFORE parsing — the HMAC is computed over the
  // exact bytes the provider sent, so any normalization (e.g. JSON
  // round-trip) breaks signature verification.
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-pc-signature");
  const eventHeader = req.headers.get("x-pc-event");

  const config = await loadPrintingComicsConfig();
  if (!config) {
    log.warn("Webhook received but Printing Comics is not configured");
    // Reply 2xx so the provider doesn't retry forever during a brief
    // misconfiguration window. We log loudly so operators notice.
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }

  if (config.webhookSecret) {
    const verification = verifyPrintingComicsWebhook(
      config.webhookSecret,
      signatureHeader,
      rawBody
    );
    if (!verification.ok) {
      log.warn({ reason: verification.reason }, "Printing Comics webhook signature failed");
      return NextResponse.json(
        { ok: false, error: "invalid signature" },
        { status: 401 }
      );
    }
  } else {
    // No signing secret configured — accept the webhook but log it.
    // Once the integration is fully live the admin should rotate +
    // save the secret to enable verification.
    log.warn("Accepting Printing Comics webhook WITHOUT signature verification (no webhook secret configured)");
  }

  let payload: PCWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    log.warn("Printing Comics webhook body was not valid JSON");
    return NextResponse.json({ ok: false, reason: "invalid_json" });
  }

  // Prefer the X-PC-Event header (per docs); fall back to body.event
  // if the provider stops sending the header in a future revision.
  const eventName = (eventHeader || payload.event) as PCWebhookEvent | undefined;
  const order = payload.data?.order;
  if (!eventName || !order) {
    log.warn({ eventName, hasOrder: !!order }, "Printing Comics webhook missing event/order");
    return NextResponse.json({ ok: false, reason: "missing_event_or_order" });
  }

  const mappedStatus = STATUS_MAP[eventName];
  if (!mappedStatus) {
    log.warn({ eventName }, "Unknown Printing Comics event — acking and ignoring");
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Find the pledge: prefer externalRef (= pledge.id), fall back to
  // the orderId we stored at submit time.
  const where = order.externalRef
    ? { id: order.externalRef }
    : order.id
    ? { printingComicsOrderId: order.id }
    : null;
  if (!where) {
    log.warn({ eventName, order }, "Printing Comics webhook had no resolvable order key");
    return NextResponse.json({ ok: false, reason: "no_resolvable_key" });
  }

  try {
    const updateResult = await db.pledge.updateMany({
      where: { ...where, deletedAt: null },
      data: {
        printingComicsOrderId: order.id || undefined,
        printingComicsOrderNumber: order.number || undefined,
        printingComicsStatus: mappedStatus,
        printingComicsTrackingNumber: order.trackingNumber || undefined,
        printingComicsLastSyncedAt: new Date(),
      },
    });
    if (updateResult.count === 0) {
      log.warn({ eventName, where }, "Printing Comics webhook didn't match any pledge");
    } else {
      log.info(
        { eventName, status: mappedStatus, where, count: updateResult.count },
        "Printing Comics webhook applied"
      );
    }
  } catch (err) {
    log.error({ err: String(err), eventName }, "Printing Comics webhook DB write failed");
    // Reply 5xx so the provider retries — better to double-process
    // than miss a status update.
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
