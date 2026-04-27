import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { loadNmiConfig } from "@/lib/nmi";

const nmiWebhookLogger = logger.child({ module: "nmi-webhook" });

export const dynamic = "force-dynamic";

// NMI webhook receiver. The exact payload + signature scheme depends
// on the merchant account configuration (NMI offers both legacy
// query-string payloads and newer JSON envelopes with HMAC). We
// accept both shapes; signature verification is best-effort and only
// enforced when a webhook secret has been configured.
//
// Pledge-row updates land once the pledge flow is wired up (TODO).
//
// CSRF-exempt automatically via the existing /api/webhooks prefix in
// src/proxy.ts.

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const contentType = req.headers.get("content-type") || "";

  let payload: Record<string, unknown> = {};
  try {
    if (contentType.includes("application/json")) {
      payload = raw ? JSON.parse(raw) : {};
    } else {
      // form-encoded / query-string payload
      const params = new URLSearchParams(raw);
      for (const [k, v] of params.entries()) payload[k] = v;
    }
  } catch (err) {
    nmiWebhookLogger.warn({ err: String(err) }, "Failed to parse NMI webhook body");
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const config = await loadNmiConfig();
  if (!config) {
    nmiWebhookLogger.warn("NMI webhook received but processor disabled / unconfigured");
    return NextResponse.json({ ok: true, ignored: "disabled" });
  }

  // Optional signature verification — only enforced when both a
  // shared secret and a signature header are present. NMI's signature
  // scheme is configurable per merchant; document the chosen flavor
  // in the admin docs and wire the verifier here once pinned down.
  if (config.webhookSecret) {
    // TODO: implement signature verification once the NMI account's
    // webhook signature mode is locked in. For now, we log so we can
    // observe what header NMI is actually sending.
    const candidateHeaders = [
      "webhook-signature",
      "x-nmi-signature",
      "x-signature",
    ];
    const signatures: Record<string, string | null> = {};
    for (const h of candidateHeaders) signatures[h] = req.headers.get(h);
    nmiWebhookLogger.info(
      { signatures },
      "NMI webhook signature headers (verifier TODO)"
    );
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
