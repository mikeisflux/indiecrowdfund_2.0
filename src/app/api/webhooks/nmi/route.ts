import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "@/lib/logger";
import { loadNmiConfig } from "@/lib/nmi";

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

const ALLOWED_WEBHOOK_IPS = new Set<string>([
  ...Array.from({ length: 7 }, (_, i) => `104.192.32.${81 + i}`),
  ...Array.from({ length: 7 }, (_, i) => `104.192.36.${81 + i}`),
]);

function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    // First entry is the original client; downstream entries are proxies.
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
    { eventType, hasTransactionId: !!payload.transactionid },
    "NMI webhook received"
  );

  // TODO: route eventType to the appropriate Pledge-row update once
  // the pledge flow is wired up:
  //   - sale.success / transaction.approved → mark Pledge COMPLETED
  //   - sale.failed   / transaction.declined → mark Pledge FAILED
  //   - refund.success                       → mark Pledge REFUNDED
  //   - chargeback                           → flag Pledge for review

  return NextResponse.json({ ok: true });
}
