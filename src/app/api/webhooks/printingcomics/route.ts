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
// We resolve the inbound event back to a ProjectPrintOrder using one
// of two keys depending on what the provider includes:
//   - data.order.externalRef   (we set this to ProjectPrintOrder.id on submit)
//   - data.order.id            (saved on ProjectPrintOrder.printingComicsOrderId
//                               after the create-order response)

interface PCWebhookPayload {
  event?: PCWebhookEvent;
  // proof.* events carry the PC order id at the top level.
  orderId?: string;
  data?: {
    order?: {
      id?: string;
      number?: string;
      externalRef?: string;
      status?: string;
      paymentStatus?: string;
      shippingMethod?: string;
      trackingNumber?: string;
      proofStatus?: string;
    };
    payment?: {
      approvalUrl?: string;
      expiresAt?: string;
      provider?: string;
      providerRef?: string;
      amountCents?: number;
      paidAt?: string;
    };
    // Real payloads are the FLAT serialized order at data.* (order.created
    // has data.id/data.externalRef — NOT data.order.*), and proof.* events
    // carry flat proof fields. The stable cross-event key is top-level
    // `orderId` (= Order.id) on every event.
    id?: string;
    orderId?: string;
    number?: string;
    externalRef?: string;
    status?: string;
    paymentStatus?: string;
    shippingMethod?: string;
    trackingNumber?: string;
    // proof fields
    proofVersion?: number;
    token?: string;
    reviewUrl?: string;
    fileUrl?: string;
    approvedName?: string;
    note?: string;
  };
}

// payment_link_created doesn't map to an order status — it just
// updates the cached approvalUrl + expiresAt on the local row. We
// model it with a sentinel here and skip the status-update branch
// when we see it.
const STATUS_MAP: Record<PCWebhookEvent, string | null> = {
  "order.created": "PENDING",
  "order.payment_link_created": null,
  "order.paid": "PAID",
  "order.in_production": "IN_PRODUCTION",
  "order.shipped": "SHIPPED",
  "order.delivered": "DELIVERED",
  "order.cancelled": "CANCELLED",
  "order.refunded": "REFUNDED",
  // Proof events are handled in their own branch (they don't change the
  // order's production status); listed here to satisfy the exhaustive map.
  "proof.ready": null,
  "proof.approved": null,
  "proof.changes_requested": null,
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

  if (!config.webhookSecret) {
    // No signing secret configured. We used to accept-and-warn here, but
    // that meant anyone who learned a ProjectPrintOrder id (or guessed an
    // externalRef format) could flip order status by hand. The handler
    // doesn't mutate money flow, but spoofed "order.shipped" / "paid" /
    // "refunded" events can mislead creators and corrupt fulfillment
    // state. Reject loudly so operators know to configure the secret.
    log.error("Rejecting Printing Comics webhook -- no webhook secret configured. Set it in admin/settings to enable verification.");
    return NextResponse.json(
      { ok: false, error: "webhook secret not configured" },
      { status: 503 }
    );
  }

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
  const evtStr = String(eventName ?? "");

  // ---- Hard proof events (proof.ready / proof.approved / proof.changes_requested) ----
  // These carry a FLAT data payload — { orderId, number, proofVersion,
  // status, token, reviewUrl, fileUrl, approvedName, note } — with NO
  // data.order, so handle them before the order-object guard and resolve by
  // the Printing Comics order id.
  if (evtStr.startsWith("proof.")) {
    const d = payload.data || {};
    // Stable cross-event key is the top-level orderId (= Order.id).
    const pcOrderId = payload.orderId || d.orderId;
    if (!pcOrderId) {
      log.warn({ evtStr }, "Proof webhook missing orderId");
      return NextResponse.json({ ok: false, reason: "missing_order_id" });
    }
    const existing = await db.projectPrintOrder.findFirst({
      where: { printingComicsOrderId: pcOrderId },
      select: { id: true, submittedById: true, projectId: true, proofStatus: true },
    });
    if (!existing) {
      log.warn({ pcOrderId }, "Proof webhook: no matching print order");
      return NextResponse.json({ ok: true, ignored: true });
    }

    await db.projectPrintOrder.update({
      where: { id: existing.id },
      data: {
        proofStatus: d.status ?? undefined,
        proofUrl: d.fileUrl ?? undefined,
        proofReviewUrl: d.reviewUrl ?? undefined,
        proofVersion: d.proofVersion ?? undefined,
        proofUpdatedAt: new Date(),
        lastSyncedAt: new Date(),
      },
    });

    // Notify the creator only on a NEW proof.ready (not on their own
    // approve / changes-requested actions, and not on repeat deliveries).
    if (evtStr === "proof.ready" && existing.proofStatus !== "awaiting_approval" && existing.submittedById) {
      await db.notification
        .create({
          data: {
            userId: existing.submittedById,
            type: "SYSTEM",
            title: "Your print proof is ready to review",
            message:
              "Printing Comics uploaded a proof of your print order. Review it and approve (or request changes) to start production.",
            actionUrl: d.reviewUrl || "/dashboard/indiekit",
            projectId: existing.projectId,
          },
        })
        .catch((e: unknown) => log.warn({ err: String(e) }, "proof notification failed (non-fatal)"));
    }

    return NextResponse.json({ ok: true, proof: true, event: evtStr });
  }

  // ---- Order.* events ----
  // Real payloads are a FLAT serialized order at data.* (order.created has
  // data.id / data.externalRef, NOT data.order.*), with the id also at the
  // top-level `orderId` on EVERY event — the stable cross-event key. We
  // normalize both the flat and the older nested (data.order) shapes.
  if (!eventName) {
    return NextResponse.json({ ok: false, reason: "missing_event" });
  }
  if (!(eventName in STATUS_MAP)) {
    log.warn({ eventName }, "Unknown Printing Comics event — acking and ignoring");
    return NextResponse.json({ ok: true, ignored: true });
  }
  const mappedStatus = STATUS_MAP[eventName];

  const d0 = payload.data || {};
  const order =
    d0.order && typeof d0.order === "object"
      ? d0.order
      : (d0 as NonNullable<PCWebhookPayload["data"]>);
  // Primary key = top-level orderId (= Order.id), stored as
  // printingComicsOrderId. externalRef (our "<projectId>:<printOrderId>")
  // links order.created before we've stored the PC id.
  const pcOrderId = payload.orderId || order.id;
  let where: { id: string } | { printingComicsOrderId: string } | null = null;
  if (order.externalRef) {
    const parts = order.externalRef.split(":");
    where = { id: parts.length > 1 ? parts[parts.length - 1] : order.externalRef };
  } else if (pcOrderId) {
    where = { printingComicsOrderId: pcOrderId };
  }
  if (!where) {
    log.warn({ eventName, order }, "Printing Comics webhook had no resolvable order key");
    return NextResponse.json({ ok: false, reason: "no_resolvable_key" });
  }

  // Per-event data side-effects layered onto the base status update.
  const data: Record<string, unknown> = {
    printingComicsOrderId: pcOrderId || undefined,
    printingComicsOrderNumber: order.number || undefined,
    shippingMethod: order.shippingMethod || undefined,
    trackingNumber: order.trackingNumber || undefined,
    lastSyncedAt: new Date(),
  };
  if (mappedStatus) data.status = mappedStatus;

  // payment_link_created — refresh the cached PayPal approval URL.
  if (eventName === "order.payment_link_created" && payload.data?.payment) {
    if (payload.data.payment.approvalUrl) data.paymentApprovalUrl = payload.data.payment.approvalUrl;
    if (payload.data.payment.expiresAt) data.paymentApprovalUrlExpiresAt = new Date(payload.data.payment.expiresAt);
    if (payload.data.payment.provider) data.paymentProvider = payload.data.payment.provider;
  }

  // order.paid — stamp paidAt + provider + reference, clear any stale
  // approval URL since the order's now paid.
  if (eventName === "order.paid") {
    data.paidAt = payload.data?.payment?.paidAt ? new Date(payload.data.payment.paidAt) : new Date();
    if (payload.data?.payment?.provider) data.paymentProvider = payload.data.payment.provider;
    if (payload.data?.payment?.providerRef) data.paymentReference = payload.data.payment.providerRef;
    data.paymentApprovalUrl = null;
    data.paymentApprovalUrlExpiresAt = null;
  }

  try {
    const updateResult = await db.projectPrintOrder.updateMany({
      where,
      data,
    });
    if (updateResult.count === 0) {
      log.warn({ eventName, where }, "Printing Comics webhook didn't match any print order");
    } else {
      log.info(
        { eventName, status: mappedStatus, where, count: updateResult.count },
        "Printing Comics webhook applied"
      );
    }
  } catch (err) {
    log.error({ err: String(err), eventName }, "Printing Comics webhook DB write failed");
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
