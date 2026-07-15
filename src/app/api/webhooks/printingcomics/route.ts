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
    // Hard proof payload (proof.* / order.proof_* events).
    proof?: {
      fileUrl?: string;
      reviewUrl?: string;
      status?: string;
      version?: number;
    };
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
  const order = payload.data?.order;
  if (!eventName || !order) {
    log.warn({ eventName, hasOrder: !!order }, "Printing Comics webhook missing event/order");
    return NextResponse.json({ ok: false, reason: "missing_event_or_order" });
  }

  // ---- Hard proof events ----
  // The printer uploads a proof and webhooks us (event name like
  // "order.proof_ready" / "proof.ready", or a payload with data.proof).
  // These don't change the order's production status — they update the
  // proof fields and notify the creator to review. Detected by event name
  // OR proof payload so the exact event string doesn't matter.
  const evtStr = String(eventName);
  const proofData = payload.data?.proof;
  if (evtStr.includes("proof") || proofData) {
    const key = order.externalRef
      ? { id: (order.externalRef.split(":").pop() as string) }
      : order.id
      ? { printingComicsOrderId: order.id }
      : null;
    if (!key) {
      return NextResponse.json({ ok: false, reason: "no_resolvable_key" });
    }
    const existing = await db.projectPrintOrder.findFirst({
      where: key,
      select: { id: true, submittedById: true, projectId: true, proofStatus: true },
    });
    if (!existing) {
      log.warn({ key }, "Proof webhook: no matching print order");
      return NextResponse.json({ ok: true, ignored: true });
    }

    const newStatus = order.proofStatus || proofData?.status || existing.proofStatus || undefined;
    await db.projectPrintOrder.update({
      where: { id: existing.id },
      data: {
        proofStatus: newStatus,
        proofUrl: proofData?.fileUrl ?? undefined,
        proofReviewUrl: proofData?.reviewUrl ?? undefined,
        proofVersion: proofData?.version ?? undefined,
        proofUpdatedAt: new Date(),
        lastSyncedAt: new Date(),
      },
    });

    // Notify the creator once, when a fresh proof becomes ready to review.
    const readyForReview =
      newStatus === "awaiting_approval" ||
      proofData?.status === "pending" ||
      evtStr.includes("ready") ||
      evtStr.includes("uploaded");
    if (readyForReview && existing.proofStatus !== "awaiting_approval" && existing.submittedById) {
      await db.notification
        .create({
          data: {
            userId: existing.submittedById,
            type: "SYSTEM",
            title: "Your print proof is ready to review",
            message:
              "Printing Comics uploaded a proof of your print order. Review it and approve (or request changes) to start production.",
            actionUrl: proofData?.reviewUrl || "/dashboard/indiekit",
            projectId: existing.projectId,
          },
        })
        .catch((e: unknown) => log.warn({ err: String(e) }, "proof notification failed (non-fatal)"));
    }

    return NextResponse.json({ ok: true, proof: true });
  }

  // STATUS_MAP returns null for events that don't change the local
  // order status (currently just order.payment_link_created — a pure
  // payment-URL refresh). Anything not in the map at all is ignored.
  if (!(eventName in STATUS_MAP)) {
    log.warn({ eventName }, "Unknown Printing Comics event — acking and ignoring");
    return NextResponse.json({ ok: true, ignored: true });
  }
  const mappedStatus = STATUS_MAP[eventName];

  // Find the local ProjectPrintOrder. externalRef is now formatted
  // "<projectId>:<printOrderId>" so PrintingComics' admin can group
  // by project — split on ':' to get the print-order id we use as
  // the primary key. Fall back to a raw match (older rows) and to
  // the printingComicsOrderId we stored at submit time.
  let where: { id: string } | { printingComicsOrderId: string } | null = null;
  if (order.externalRef) {
    const parts = order.externalRef.split(":");
    const printOrderId = parts.length > 1 ? parts[parts.length - 1] : order.externalRef;
    where = { id: printOrderId };
  } else if (order.id) {
    where = { printingComicsOrderId: order.id };
  }
  if (!where) {
    log.warn({ eventName, order }, "Printing Comics webhook had no resolvable order key");
    return NextResponse.json({ ok: false, reason: "no_resolvable_key" });
  }

  // Per-event data side-effects layered onto the base status update.
  const data: Record<string, unknown> = {
    printingComicsOrderId: order.id || undefined,
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
