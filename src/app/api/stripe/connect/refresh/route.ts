import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/payments/stripe";

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

    // Create a new account link for re-onboarding
    const accountLink = await stripe.accountLinks.create({
      account: config.stripeAccountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payment/stripe/refresh`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payment/stripe/complete`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      onboardingUrl: accountLink.url,
    });
  } catch (error) {
    console.error("Stripe refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh onboarding link" },
      { status: 500 }
    );
  }
}
