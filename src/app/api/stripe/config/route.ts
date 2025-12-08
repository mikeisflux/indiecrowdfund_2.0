import { NextResponse } from "next/server";
import { getStripePublishableKey } from "@/lib/payments/stripe";
import { db } from "@/lib/db";

// Get Stripe configuration for the frontend (publishable key only)
export async function GET() {
  try {
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
    console.error("Error getting Stripe config:", error);
    return NextResponse.json(
      { error: "Failed to get Stripe configuration" },
      { status: 500 }
    );
  }
}
