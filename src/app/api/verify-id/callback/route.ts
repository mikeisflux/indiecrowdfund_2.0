import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const verifyIdCallbackLogger = logger.child({ module: "verify-id-callback" });
import { getShuftiService } from "@/lib/shufti";
import { db } from "@/lib/db";
import crypto from "crypto";

/**
 * Verify Shufti webhook signature using constant-time comparison (prevents timing attacks)
 */
function verifySignature(payload: string, signature: string, secretKey: string): boolean {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(payload)
      .digest("hex");
    // Use timingSafeEqual to prevent timing-based side-channel attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * POST /api/verify-id/callback - Shufti webhook callback
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("signature") || "";

    // Get settings to verify signature
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { shuftiSecretKey: true, idVerificationEnabled: true },
    });

    // Enforce signature verification when ID verification is enabled.
    // If secret key is not configured but verification is enabled, reject the request
    // to prevent accepting forged verification callbacks.
    if (settings?.idVerificationEnabled) {
      if (!settings.shuftiSecretKey) {
        verifyIdCallbackLogger.error("ID verification enabled but Shufti secret key not configured");
        return NextResponse.json({ error: "Service misconfigured" }, { status: 503 });
      }
      if (!signature || !verifySignature(rawBody, signature, settings.shuftiSecretKey)) {
        verifyIdCallbackLogger.error("Invalid or missing Shufti webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else if (settings?.shuftiSecretKey && signature) {
      // Verify if we have a key, even if verification isn't explicitly enabled
      if (!verifySignature(rawBody, signature, settings.shuftiSecretKey)) {
        verifyIdCallbackLogger.error("Invalid Shufti webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const data = JSON.parse(rawBody);

    // Get Shufti service and process callback
    const shufti = await getShuftiService();

    if (!shufti) {
      verifyIdCallbackLogger.error("Shufti service not configured");
      return NextResponse.json({ error: "Service not configured" }, { status: 503 });
    }

    const result = await shufti.processCallback(data);

    if (!result.success) {
      return NextResponse.json({ error: "Failed to process callback" }, { status: 500 });
    }

    verifyIdCallbackLogger.info(`Verification callback processed: userId=${result.userId}, verified=${result.verified}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    verifyIdCallbackLogger.error({ err: formatError(error) }, "Error processing Shufti callback:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
