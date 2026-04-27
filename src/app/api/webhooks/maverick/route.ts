import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { loadMaverickConfig, verifyWebhookSignature } from "@/lib/maverick";

const mavWebhookLogger = logger.child({ module: "maverick-webhook" });

export const dynamic = "force-dynamic";

// Maverick Payments webhook receiver.
//
// Events are JSON envelopes shaped as:
//   { id, module, action, date, data: {...} }
//
// Signature header: `Webhook-Signature: <hex sha512>` where the digest
// is sha512(<webhookSignature><id><module><action><date>) — i.e. the
// data payload is NOT included in the signature, just the envelope
// fields. The shared secret is per-webhook-URL, configured in the
// Maverick dashboard and stored encrypted in PlatformSettings.
//
// We CSRF-exempt this route via the existing /api/webhooks prefix in
// src/proxy.ts.

interface MaverickWebhookEnvelope {
  id: string | number;
  module: string;
  action: string;
  date: string;
  data?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  let envelope: MaverickWebhookEnvelope;
  try {
    envelope = raw ? JSON.parse(raw) : ({} as MaverickWebhookEnvelope);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!envelope?.id || !envelope.module || !envelope.action || !envelope.date) {
    return NextResponse.json(
      { error: "Missing envelope fields" },
      { status: 400 }
    );
  }

  // Pull the configured secret. If Maverick isn't enabled or the secret
  // hasn't been set yet, accept the event but log a warning so admins
  // can still test the wiring during setup.
  const config = await loadMaverickConfig();
  if (!config) {
    mavWebhookLogger.warn(
      { id: envelope.id, action: envelope.action },
      "Maverick webhook received but processor disabled / unconfigured — accepting and dropping"
    );
    return NextResponse.json({ ok: true, ignored: "disabled" });
  }

  if (config.webhookSecret) {
    const sigHeader =
      req.headers.get("webhook-signature") ||
      req.headers.get("Webhook-Signature");
    if (!sigHeader) {
      mavWebhookLogger.warn(
        { id: envelope.id, action: envelope.action },
        "Missing Webhook-Signature header"
      );
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    const ok = verifyWebhookSignature(config.webhookSecret, sigHeader, {
      id: envelope.id,
      module: envelope.module,
      action: envelope.action,
      date: envelope.date,
    });
    if (!ok) {
      mavWebhookLogger.warn(
        { id: envelope.id, action: envelope.action },
        "Maverick webhook signature mismatch"
      );
      return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    }
  } else {
    mavWebhookLogger.warn(
      { id: envelope.id, action: envelope.action },
      "Maverick webhook signature not enforced — secret not configured"
    );
  }

  // Route by module + action. The actual pledge/transaction handling
  // lands once the pledge flow is wired up. For now we log and ack so
  // Maverick stops retrying.
  const key = `${envelope.module}.${envelope.action}`;
  mavWebhookLogger.info(
    { id: envelope.id, key, hasData: !!envelope.data },
    "Maverick webhook received"
  );

  switch (key) {
    case "transaction.create":
      // TODO: mark Pledge as PAID when its mavTransactionId matches.
      break;
    case "transaction.refund":
      // TODO: mark Pledge as REFUNDED.
      break;
    case "transaction.recurring":
      // TODO: handle recurring (membership / subscription).
      break;
    default:
      // Unknown event — acknowledge so Maverick stops retrying.
      break;
  }

  return NextResponse.json({ ok: true });
}
