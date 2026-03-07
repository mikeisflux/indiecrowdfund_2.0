import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorStripePortalLogger = logger.child({ module: "creator-stripe-portal" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's Stripe customer ID
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found. Please make a purchase first." },
        { status: 400 }
      );
    }

    // Create a billing portal session
    const stripe = await getStripeInstance();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/indiekit`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    creatorStripePortalLogger.error({ err: String(error) }, "Stripe portal error:");
    return NextResponse.json(
      { error: "Failed to create billing portal session" },
      { status: 500 }
    );
  }
}
