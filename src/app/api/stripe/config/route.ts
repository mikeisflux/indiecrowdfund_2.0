import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const stripeConfigLogger = logger.child({ module: "stripe-config" });
import { getStripePublishableKey } from "@/lib/payments/stripe";
import { db } from "@/lib/db";

// Force dynamic - this route requires database access
export const dynamic = "force-dynamic";

// Get Stripe configuration for the frontend (publishable key only)
export async function GET() {
  try {
    // Check if database is available
    if (!db?.platformSettings) {
      return NextResponse.json({
        enabled: false,
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
      });
    }

    // Check if Stripe is enabled
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { stripeEnabled: true },
    });

    if (!settings?.stripeEnabled) {
      return NextResponse.json({
        enabled: false,
        publishableKey: null,
      });
    }

    // Get publishable key (this is safe to expose to the frontend)
    const publishableKey = await getStripePublishableKey();

    return NextResponse.json({
      enabled: true,
      publishableKey,
    });
  } catch (error) {
    stripeConfigLogger.error({ err: String(error) }, "Error getting Stripe config:");
    // Fall back to env var if database fails
    return NextResponse.json({
      enabled: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
    });
  }
}
