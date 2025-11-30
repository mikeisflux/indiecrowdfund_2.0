import { NextRequest, NextResponse } from "next/server";
import { getShuftiService } from "@/lib/shufti";
import { db } from "@/lib/db";
import crypto from "crypto";

/**
 * Verify Shufti webhook signature
 */
function verifySignature(payload: string, signature: string, secretKey: string): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(payload)
    .digest("hex");
  return signature === expectedSignature;
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
      select: { shuftiSecretKey: true },
    });

    // Verify signature if secret key is configured
    if (settings?.shuftiSecretKey && signature) {
      if (!verifySignature(rawBody, signature, settings.shuftiSecretKey)) {
        console.error("Invalid Shufti webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const data = JSON.parse(rawBody);

    // Get Shufti service and process callback
    const shufti = await getShuftiService();

    if (!shufti) {
      console.error("Shufti service not configured");
      return NextResponse.json({ error: "Service not configured" }, { status: 503 });
    }

    const result = await shufti.processCallback(data);

    if (!result.success) {
      return NextResponse.json({ error: "Failed to process callback" }, { status: 500 });
    }

    console.log(`Verification callback processed: userId=${result.userId}, verified=${result.verified}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing Shufti callback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
