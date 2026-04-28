import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { loadNmiConfig, saleByVaultToken } from "@/lib/nmi";

const nmiWebhookLogger = logger.child({ module: "nmi-webhook" });

export const dynamic = "force-dynamic";

// PaymentCloud / NMI webhook receiver.
//
// Signature scheme (per Settings → Webhooks docs):
//   header: Webhook-Signature: t=<nonce>,s=<sig>
//   sig    = HMAC-SHA256(nonce + "." + rawBody, signingKey)
//
// Source IP allowlist (PaymentCloud-published ranges):
//   104.192.32.81 - 104.192.32.87
//   104.192.36.81 - 104.192.36.87
//
// CSRF-exempt automatically via the /api/webhooks prefix in src/proxy.ts.
//
// Events handled (subscribed in PaymentCloud Settings → Webhooks):
//   transaction.sale.success/failure/unknown — pledge lifecycle
//   transaction.refund.success/failure       — refund confirmation
//   transaction.void.success/failure         — pre-settlement void
//   chargeback.batch.complete                — chargeback received
//                                              (auto-recoups via the
//                                              creator's chargeback card)
//   settlement.batch.complete/failure        — payout reconciliation

const ALLOWED_WEBHOOK_IPS = new Set<string>([
  ...Array.from({ length: 7 }, (_, i) => `104.192.32.${81 + i}`),
  ...Array.from({ length: 7 }, (_, i) => `104.192.36.${81 + i}`),
]);

function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

function verifySignature(
  signingKey: string,
  rawBody: string,
  sigHeader: string
): { ok: true } | { ok: false; reason: string } {
  const match = /^t=([^,]+),s=(.+)$/.exec(sigHeader.trim());
  if (!match) return { ok: false, reason: "unrecognized signature format" };
  const [, nonce, providedSig] = match;
  const expected = createHmac("sha256", signingKey)
    .update(`${nonce}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(providedSig, "utf8");
  if (a.length !== b.length) return { ok: false, reason: "signature mismatch" };
  if (!timingSafeEqual(a, b)) return { ok: false, reason: "signature mismatch" };
  return { ok: true };
}

// PaymentCloud webhook bodies arrive as either a JSON envelope (new
// format with `data: {...}`) or a flat query-string payload. We
// normalize by trying common field names at both top level and under
// `data` so the handler is resilient to either shape.
function readPayloadField(
  payload: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const k of keys) {
    const top = payload[k];
    if (typeof top === "string" && top.length > 0) return top;
    if (typeof top === "number") return String(top);
  }
  const data = payload.data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.length > 0) return v;
      if (typeof v === "number") return String(v);
    }
  }
  return null;
}

function extractTransactionId(payload: Record<string, unknown>): string | null {
  return readPayloadField(payload, [
    "transaction_id",
    "transactionid",
    "original_transaction_id",
    "originalTransactionId",
    "originalTransactionID",
  ]);
}

function extractAmount(payload: Record<string, unknown>): number | null {
  const raw = readPayloadField(payload, [
    "amount",
    "chargeback_amount",
    "chargebackAmount",
  ]);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractChargebackId(payload: Record<string, unknown>): string | null {
  return readPayloadField(payload, [
    "chargeback_id",
    "chargebackId",
    "event_id",
    "eventId",
    "id",
  ]);
}

function extractReasonCode(payload: Record<string, unknown>): string | null {
  return readPayloadField(payload, [
    "reason_code",
    "reasonCode",
    "reason",
  ]);
}

// --------------------------------------------------------------------
// Event handlers
// --------------------------------------------------------------------

// Sale-result events: confirm or fail an NMI pledge that the cron or
// confirm-nmi route already attempted. Idempotent: if we already
// marked the pledge COMPLETED/FAILED, we no-op.
async function handleSaleResult(
  payload: Record<string, unknown>,
  status: "approved" | "declined"
): Promise<void> {
  const txnId = extractTransactionId(payload);
  if (!txnId) {
    nmiWebhookLogger.warn({ payload }, "Sale webhook missing transaction id");
    return;
  }
  const pledge = await db.pledge.findFirst({
    where: { nmiTransactionId: txnId, deletedAt: null, paymentProcessor: "NMI" },
    select: { id: true, status: true },
  });
  if (!pledge) {
    nmiWebhookLogger.info({ txnId }, "Sale webhook: no matching pledge (possibly chargeback card sale)");
    return;
  }
  if (status === "approved" && pledge.status !== "COMPLETED") {
    await db.pledge.updateMany({
      where: { id: pledge.id, status: "PENDING" },
      data: { status: "COMPLETED", chargedImmediately: true },
    });
  } else if (status === "declined" && pledge.status === "PENDING") {
    await db.pledge.updateMany({
      where: { id: pledge.id, status: "PENDING" },
      data: { status: "FAILED", lastFailureReason: "Declined per webhook" },
    });
  }
}

// Refund-result events: confirm a pledge has been refunded by NMI.
async function handleRefundResult(payload: Record<string, unknown>): Promise<void> {
  const txnId = extractTransactionId(payload);
  if (!txnId) return;
  await db.pledge.updateMany({
    where: { nmiTransactionId: txnId, status: "COMPLETED", paymentProcessor: "NMI", deletedAt: null },
    data: { status: "REFUNDED" },
  });
}

// Chargeback handler: mark the pledge CHARGEBACK and try to auto-recoup
// via the creator's saved chargeback card. Idempotent on (txnId,
// chargebackId) — if we already recouped this exact chargeback, skip.
async function handleChargeback(payload: Record<string, unknown>): Promise<void> {
  const txnId = extractTransactionId(payload);
  if (!txnId) {
    nmiWebhookLogger.warn({ payload }, "Chargeback webhook missing transaction id");
    return;
  }
  const amount = extractAmount(payload);
  const chargebackId = extractChargebackId(payload);
  const reasonCode = extractReasonCode(payload);

  const pledge = await db.pledge.findFirst({
    where: {
      nmiTransactionId: txnId,
      deletedAt: null,
      paymentProcessor: "NMI",
    },
    select: {
      id: true,
      amount: true,
      status: true,
      projectId: true,
      userId: true,
      metadata: true,
      project: {
        select: {
          id: true,
          title: true,
          creatorId: true,
          // Per-project (legacy) chargeback card. Used as fallback if
          // the creator hasn't saved a user-level card yet.
          chargebackCard: {
            select: {
              id: true,
              nmiCustomerVaultId: true,
              cardLastFour: true,
              cardBrand: true,
            },
          },
          // User-level chargeback card on the creator's account —
          // preferred. One card covers all the creator's pledges and
          // marketplace sales.
          creator: {
            select: {
              id: true,
              marketplaceChargebackCard: {
                select: {
                  id: true,
                  nmiCustomerVaultId: true,
                  cardLastFour: true,
                  cardBrand: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!pledge) {
    nmiWebhookLogger.warn({ txnId }, "Chargeback webhook: no matching pledge");
    return;
  }

  // Idempotency: if we already saw this exact chargeback event, skip.
  const existingMeta = (pledge.metadata as Record<string, unknown> | null) || {};
  const seenChargebacks = Array.isArray(existingMeta.chargebackEvents)
    ? (existingMeta.chargebackEvents as Array<Record<string, unknown>>)
    : [];
  if (chargebackId && seenChargebacks.some((e) => e.chargebackId === chargebackId)) {
    nmiWebhookLogger.info(
      { pledgeId: pledge.id, chargebackId },
      "Chargeback already processed; skipping"
    );
    return;
  }

  // CAS-flip COMPLETED → CHARGEBACK. Only the worker that wins the CAS
  // owns the recoup attempt; concurrent webhook deliveries will see
  // status=CHARGEBACK and skip.
  const claimed = await db.pledge.updateMany({
    where: {
      id: pledge.id,
      status: "COMPLETED",
      paymentProcessor: "NMI",
      deletedAt: null,
    },
    data: { status: "CHARGEBACK" },
  });
  // Even if the CAS lost (already CHARGEBACK), we still attempt the
  // recoup if this is a *new* chargeback event id — PaymentCloud can
  // file a second chargeback against the same transaction in rare
  // re-disputed cases. Otherwise we've already recouped; skip.
  const isNewChargeback = chargebackId
    ? !seenChargebacks.some((e) => e.chargebackId === chargebackId)
    : claimed.count > 0;
  if (!isNewChargeback) return;

  const recoupAmount = amount ?? Number(pledge.amount);
  let recoupResult: {
    success: boolean;
    transactionId: string | null;
    message: string | null;
  } = { success: false, transactionId: null, message: null };

  // Prefer the creator's user-level card (one card per creator covers
  // every pledge + marketplace sale they have). Fall back to the
  // legacy per-project card if the creator hasn't migrated yet.
  const cardVaultId =
    pledge.project.creator?.marketplaceChargebackCard?.nmiCustomerVaultId ??
    pledge.project.chargebackCard?.nmiCustomerVaultId ??
    null;
  if (!cardVaultId) {
    recoupResult.message = "Creator has no chargeback card on file";
    nmiWebhookLogger.warn(
      { pledgeId: pledge.id, projectId: pledge.projectId, recoupAmount },
      "Chargeback received: cannot auto-recoup, no chargeback card on file"
    );
  } else {
    const config = await loadNmiConfig();
    if (!config) {
      recoupResult.message = "PaymentCloud not configured";
    } else {
      try {
        const sale = await saleByVaultToken(config, {
          amount: recoupAmount,
          customerVaultId: cardVaultId,
          orderid: `recoup-${pledge.id}-${chargebackId || Date.now()}`,
          orderdescription: `Chargeback recoup for ${pledge.project.title} (pledge ${pledge.id})`,
        });
        if (sale.response === "1" && sale.transactionid) {
          recoupResult = {
            success: true,
            transactionId: sale.transactionid,
            message: null,
          };
          nmiWebhookLogger.info(
            {
              pledgeId: pledge.id,
              projectId: pledge.projectId,
              recoupAmount,
              recoupTransactionId: sale.transactionid,
            },
            "Chargeback auto-recoup succeeded"
          );
        } else {
          recoupResult.message = sale.responsetext || "PaymentCloud declined the recoup charge";
          nmiWebhookLogger.warn(
            {
              pledgeId: pledge.id,
              projectId: pledge.projectId,
              response: sale.response,
              text: sale.responsetext,
            },
            "Chargeback auto-recoup declined"
          );
        }
      } catch (err) {
        recoupResult.message =
          err instanceof Error ? err.message : "Network error during recoup";
        nmiWebhookLogger.error(
          { pledgeId: pledge.id, err: String(err) },
          "Chargeback auto-recoup error"
        );
      }
    }
  }

  // Persist the chargeback event + recoup outcome on the pledge so
  // admins can audit later. Append to the existing metadata array
  // rather than overwriting, in case more events arrive for the same
  // pledge.
  const newEvent = {
    chargebackId: chargebackId || null,
    transactionId: txnId,
    amount: recoupAmount,
    reasonCode: reasonCode || null,
    receivedAt: new Date().toISOString(),
    recoup: recoupResult,
  };
  await db.pledge.update({
    where: { id: pledge.id },
    data: {
      metadata: {
        ...existingMeta,
        chargebackEvents: [...seenChargebacks, newEvent],
      } as Record<string, unknown>,
    },
  });

  // Notify the creator + a platform admin so manual follow-up can
  // happen if the auto-recoup didn't succeed.
  try {
    const notificationTitle = recoupResult.success
      ? "Chargeback auto-recouped"
      : "Chargeback received — recoup needed";
    const notificationMessage = recoupResult.success
      ? `A chargeback for $${recoupAmount.toFixed(2)} was filed on "${pledge.project.title}" and we auto-charged your saved chargeback card to recoup it.`
      : `A chargeback for $${recoupAmount.toFixed(2)} was filed on "${pledge.project.title}" but the auto-recoup failed: ${recoupResult.message || "unknown reason"}. An admin will follow up.`;
    await db.notification.create({
      data: {
        userId: pledge.project.creatorId,
        type: recoupResult.success ? "CHARGEBACK_RECOUPED" : "CHARGEBACK_RECEIVED",
        title: notificationTitle,
        message: notificationMessage,
        projectId: pledge.projectId,
      },
    });
  } catch (err) {
    nmiWebhookLogger.warn(
      { err: String(err) },
      "Failed to write creator chargeback notification"
    );
  }
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  if (clientIp && !ALLOWED_WEBHOOK_IPS.has(clientIp)) {
    nmiWebhookLogger.warn(
      { clientIp },
      "NMI webhook rejected: source IP not in allowlist"
    );
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.text();
  const contentType = req.headers.get("content-type") || "";

  const config = await loadNmiConfig();
  if (!config) {
    nmiWebhookLogger.warn("NMI webhook received but processor disabled / unconfigured");
    return NextResponse.json({ ok: true, ignored: "disabled" });
  }

  if (!config.webhookSecret) {
    nmiWebhookLogger.error("NMI webhook secret not configured — refusing to process");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const sigHeader = req.headers.get("webhook-signature");
  if (!sigHeader) {
    nmiWebhookLogger.warn("NMI webhook missing Webhook-Signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const verification = verifySignature(config.webhookSecret, raw, sigHeader);
  if (!verification.ok) {
    nmiWebhookLogger.warn(
      { reason: verification.reason },
      "NMI webhook signature verification failed"
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    if (contentType.includes("application/json")) {
      payload = raw ? JSON.parse(raw) : {};
    } else {
      const params = new URLSearchParams(raw);
      for (const [k, v] of params.entries()) payload[k] = v;
    }
  } catch (err) {
    nmiWebhookLogger.warn({ err: String(err) }, "Failed to parse NMI webhook body");
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const eventType =
    (payload.event_type as string | undefined) ??
    (payload.type as string | undefined) ??
    (payload.transaction_type as string | undefined) ??
    "unknown";

  nmiWebhookLogger.info(
    { eventType, hasTransactionId: !!extractTransactionId(payload) },
    "NMI webhook received"
  );

  // Route by event type. We always return 200 after handling so
  // PaymentCloud doesn't retry. Any internal errors are logged and
  // swallowed — we'd rather miss one than have a retry storm because
  // a downstream DB hiccup made us 500.
  try {
    if (eventType.startsWith("transaction.sale.")) {
      const status = eventType.endsWith("success") ? "approved" : "declined";
      await handleSaleResult(payload, status);
    } else if (eventType.startsWith("transaction.refund.")) {
      if (eventType.endsWith("success")) {
        await handleRefundResult(payload);
      }
    } else if (eventType.startsWith("chargeback.")) {
      await handleChargeback(payload);
    } else {
      nmiWebhookLogger.info({ eventType }, "Unhandled NMI webhook event (ack only)");
    }
  } catch (err) {
    nmiWebhookLogger.error(
      { eventType, err: err instanceof Error ? err.message : String(err) },
      "NMI webhook handler error (swallowed to avoid retry storm)"
    );
  }

  return NextResponse.json({ ok: true });
}
