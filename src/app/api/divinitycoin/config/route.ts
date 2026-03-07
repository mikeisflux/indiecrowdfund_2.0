import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const divinitycoinConfigLogger = logger.child({ module: "divinitycoin-config" });
import { db } from "@/lib/db";

/**
 * GET /api/divinitycoin/config
 *
 * Returns DivinityCoin's Stripe publishable key for rendering
 * Stripe Elements on the frontend. This is DC's key, not IndieK's.
 */
export async function GET() {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        divinityCoinEnabled: true,
        divinityCoinStripePublishableKey: true,
      },
    });

    if (!settings?.divinityCoinEnabled || !settings.divinityCoinStripePublishableKey) {
      return NextResponse.json(
        { error: "DivinityCoin payment not configured" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      stripePublishableKey: settings.divinityCoinStripePublishableKey,
    });
  } catch (error) {
    divinitycoinConfigLogger.error({ err: String(error) }, "[DivinityCoin Config] Error:");
    return NextResponse.json(
      { error: "Failed to load DivinityCoin config" },
      { status: 500 }
    );
  }
}
