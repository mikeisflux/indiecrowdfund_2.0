import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Return PayPal client ID for frontend SDK initialization
export async function GET() {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { paypalClientId: true, paypalMode: true },
    });
    const clientId = settings?.paypalClientId || process.env.PAYPAL_CLIENT_ID || "";
    const mode = settings?.paypalMode || process.env.PAYPAL_MODE || "live";

    if (!clientId) {
      return NextResponse.json({ error: "PayPal not configured" }, { status: 503 });
    }

    return NextResponse.json({ clientId, mode });
  } catch {
    return NextResponse.json({ error: "Failed to load PayPal config" }, { status: 500 });
  }
}
