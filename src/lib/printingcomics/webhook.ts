// Verify inbound Printing Comics webhook signatures.
//
// Per docs (printingcomics.com/developers § Webhooks):
//   X-PC-Event:     event name (order.created | order.paid | …)
//   X-PC-Signature: t=<unix>,v1=<hmac-sha256-of-${t}.${rawBody}>
//
// Reply 2xx within 8 seconds — acknowledge first, process async.

import { createHmac, timingSafeEqual } from "node:crypto";

export type PCWebhookEvent =
  | "order.created"
  | "order.payment_link_created"
  | "order.paid"
  | "order.in_production"
  | "order.shipped"
  | "order.delivered"
  | "order.cancelled"
  | "order.refunded"
  // Hard proofing. Flat `data` payload (no data.order): orderId, number,
  // proofVersion, status, token, reviewUrl, fileUrl, approvedName, note.
  | "proof.ready"
  | "proof.approved"
  | "proof.changes_requested";

// 5-minute replay-protection window matches the request-signing rules
// the docs publish for outbound calls. Provider docs don't pin a
// number for inbound webhooks so we use the same.
const MAX_TIMESTAMP_SKEW_S = 5 * 60;

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export function verifyPrintingComicsWebhook(
  signingSecret: string,
  signatureHeader: string | null | undefined,
  rawBody: string
): VerifyResult {
  if (!signatureHeader) return { ok: false, reason: "missing X-PC-Signature header" };

  // Header shape: "t=1717428100,v1=8a8b…"
  const parts: Record<string, string> = {};
  for (const piece of signatureHeader.split(",")) {
    const [k, v] = piece.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return { ok: false, reason: "malformed signature header" };

  const tNum = Number(t);
  if (!Number.isFinite(tNum)) return { ok: false, reason: "non-numeric timestamp" };
  const skew = Math.abs(Math.floor(Date.now() / 1000) - tNum);
  if (skew > MAX_TIMESTAMP_SKEW_S) {
    return { ok: false, reason: `timestamp skew ${skew}s exceeds ${MAX_TIMESTAMP_SKEW_S}s` };
  }

  const expected = createHmac("sha256", signingSecret)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  // timingSafeEqual requires equal-length buffers; mismatched lengths
  // would throw, which itself leaks info, so guard explicitly first.
  if (expected.length !== v1.length) return { ok: false, reason: "signature mismatch" };
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (!timingSafeEqual(a, b)) return { ok: false, reason: "signature mismatch" };

  return { ok: true };
}
