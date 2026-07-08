import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getSecret } from "@/lib/vault";
import { logger } from "@/lib/logger";

const cfWebhookLogger = logger.child({ module: "cloudflare-stream-webhook" });

export const dynamic = "force-dynamic";

// Cloudflare Stream emits events when a live input transitions between
// idle / connected / disconnected states. We use these to flip
// ChatRoom.rtmpEnabled and update viewerCount without polling.
//
// Signature header: `Webhook-Signature: time=...,sig1=<hex_hmac_sha256>`
// Verified against the secret stored in PlatformSettings.

interface CFWebhookBody {
  uid?: string;
  liveInputUid?: string;
  input?: { uid?: string };
  live_input?: { uid?: string };
  status?: { current?: { state?: string } };
  state?: string;
  event?: string;
  notificationName?: string;
  viewers?: number;
  current_viewers?: number;
  meta?: Record<string, unknown>;
}

function verifySignature(
  body: string,
  header: string | null,
  secret: string
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k.trim(), (v || "").trim()];
    })
  );
  const time = parts.time || parts.t;
  const sig = parts.sig1 || parts.v1;
  if (!time || !sig) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${time}.${body}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  let body: CFWebhookBody = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Optional signature check — only enforced when the admin has set a
  // shared secret. Skipping it makes local dev / sandboxing easier.
  const settings = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: { cloudflareStreamWebhookSecret: true },
  });
  const rawSecret = settings?.cloudflareStreamWebhookSecret;
  if (rawSecret) {
    const secret = getSecret("cloudflare_stream_webhook_secret", rawSecret);
    if (!secret) {
      cfWebhookLogger.warn("Webhook secret configured but unreadable");
    } else {
      const sigHeader = req.headers.get("webhook-signature");
      if (!verifySignature(raw, sigHeader, secret)) {
        cfWebhookLogger.warn(
          { sigHeader },
          "Cloudflare Stream webhook signature mismatch"
        );
        return NextResponse.json({ error: "Bad signature" }, { status: 401 });
      }
    }
  }

  const uid =
    body.uid ||
    body.liveInputUid ||
    body.live_input?.uid ||
    body.input?.uid ||
    null;
  if (!uid) {
    return NextResponse.json({ ok: true, ignored: "no uid" });
  }

  const room = await db.chatRoom.findFirst({
    where: { liveSessionId: uid },
    select: { id: true, rtmpEnabled: true },
  });
  if (!room) {
    cfWebhookLogger.info({ uid }, "Webhook for unknown live input — ignoring");
    return NextResponse.json({ ok: true, ignored: "unknown uid" });
  }

  const state = body.status?.current?.state || body.state || body.event || "";
  const lower = state.toLowerCase();

  if (lower.includes("connected") && !lower.includes("dis")) {
    await db.chatRoom.update({
      where: { id: room.id },
      data: {
        rtmpEnabled: true,
        liveStreamStartedAt: new Date(),
      },
    });
  } else if (lower.includes("disconnect") || lower.includes("idle")) {
    await db.chatRoom.update({
      where: { id: room.id },
      data: { rtmpEnabled: false },
    });
  }

  const incomingViewers = body.current_viewers ?? body.viewers;
  if (typeof incomingViewers === "number") {
    await db.chatRoom.update({
      where: { id: room.id },
      data: { viewerCount: Math.max(0, Math.floor(incomingViewers)) },
    });
  }

  return NextResponse.json({ ok: true });
}
