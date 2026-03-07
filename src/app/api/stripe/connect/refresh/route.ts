import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const stripeConnectRefreshLogger = logger.child({ module: "stripe-connect-refresh" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance, getSecureAppUrl } from "@/lib/payments/stripe";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get existing Stripe config
    const config = await db.stripeConfig.findUnique({
      where: { userId: session.user.id },
    });

    if (!config) {
      return NextResponse.json(
        { error: "No Stripe account found. Please start the onboarding process." },
        { status: 400 }
      );
    }

    // Get Stripe instance with database settings
    const stripeClient = await getStripeInstance();

    // Create a new account link for re-onboarding
    // Use secure URL helper to ensure HTTPS for live mode
    const baseUrl = getSecureAppUrl();
    const accountLink = await stripeClient.accountLinks.create({
      account: config.stripeAccountId,
      refresh_url: `${baseUrl}/settings/payment/stripe/refresh`,
      return_url: `${baseUrl}/settings/payment/stripe/complete`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      onboardingUrl: accountLink.url,
    });
  } catch (error) {
    stripeConnectRefreshLogger.error({ err: String(error) }, "Stripe refresh error:");
    return NextResponse.json(
      { error: "Failed to refresh onboarding link" },
      { status: 500 }
    );
  }
}
