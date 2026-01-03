import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createStripeConnectAccount, getStripeInstance } from "@/lib/payments/stripe";
import { db } from "@/lib/db";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user already has a Stripe account
    const existingConfig = await db.stripeConfig.findUnique({
      where: { userId: session.user.id },
    });

    if (existingConfig?.isOnboarded) {
      return NextResponse.json(
        { error: "Stripe account already connected" },
        { status: 400 }
      );
    }

    // Create Stripe Connect account and get onboarding URL
    const result = await createStripeConnectAccount({
      userId: session.user.id,
      email: session.user.email,
    });

    return NextResponse.json({
      onboardingUrl: result.onboardingUrl,
      accountId: result.accountId,
    });
  } catch (error) {
    console.error("Stripe Connect error:", error);
    console.error("Stripe Connect error message:", (error as Error).message);

    // Extract Stripe error message if available
    const stripeError = error as { message?: string; type?: string; code?: string };
    const errorMessage = stripeError.message || "Failed to create Stripe account";

    return NextResponse.json(
      { error: errorMessage, type: stripeError.type, code: stripeError.code },
      { status: 400 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's Stripe config
    const config = await db.stripeConfig.findUnique({
      where: { userId: session.user.id },
    });

    if (!config) {
      return NextResponse.json({
        connected: false,
        onboarded: false,
      });
    }

    // If not onboarded in DB, check with Stripe directly (webhook might be delayed)
    if (!config.isOnboarded && config.stripeAccountId) {
      try {
        const stripeClient = await getStripeInstance();
        const account = await stripeClient.accounts.retrieve(config.stripeAccountId);

        const isOnboarded = account.charges_enabled && account.payouts_enabled;

        if (isOnboarded) {
          // Update database since webhook might have been delayed
          await db.stripeConfig.update({
            where: { id: config.id },
            data: { isOnboarded: true },
          });

          return NextResponse.json({
            connected: true,
            onboarded: true,
            accountId: config.stripeAccountId,
          });
        }
      } catch (stripeError) {
        console.error("Error checking Stripe account status:", stripeError);
        // Continue with DB value if Stripe check fails
      }
    }

    return NextResponse.json({
      connected: true,
      onboarded: config.isOnboarded,
      accountId: config.stripeAccountId,
    });
  } catch (error) {
    console.error("Stripe status error:", error);
    return NextResponse.json(
      { error: "Failed to get Stripe status" },
      { status: 500 }
    );
  }
}
