import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "paypal-connect-config-public" });

export const dynamic = "force-dynamic";

// GET - Public client config for the PayPal Connect buyer SDK: the platform
// (partner) client id + mode. Separate from /api/paypal/config so the standard
// PayPal app is never exposed here.
export async function GET() {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { paypalConnectClientId: true, paypalConnectMode: true },
    });

    const clientId = settings?.paypalConnectClientId || process.env.PAYPAL_CONNECT_CLIENT_ID || "";
    const mode = settings?.paypalConnectMode || process.env.PAYPAL_CONNECT_MODE || "live";

    if (!clientId) {
      return NextResponse.json({ error: "PayPal Connect not configured" }, { status: 503 });
    }

    return NextResponse.json({ clientId, mode });
  } catch (error) {
    log.error({ err: String(error) }, "Failed to load PayPal Connect public config");
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}
