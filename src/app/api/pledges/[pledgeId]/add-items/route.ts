import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

// POST - Add additional items to a completed pledge
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;
    const body = await req.json();
    const { addonIds, amount } = body;

    if (!addonIds || !Array.isArray(addonIds) || addonIds.length === 0) {
      return NextResponse.json(
        { error: "At least one addon is required" },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    // Get the pledge with project info
    const pledge = await db.pledge.findFirst({
      where: {
        id: pledgeId,
        userId: session.user.id,
      },
      include: {
        project: {
          select: {
            id: true,
            status: true,
            creatorId: true,
            stripeConnectId: true,
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    // Verify pledge is completed
    if (pledge.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Can only add items to completed pledges" },
        { status: 400 }
      );
    }

    // Verify project is still live
    if (pledge.project.status !== "LIVE") {
      return NextResponse.json(
        { error: "Can only add items while the campaign is live" },
        { status: 400 }
      );
    }

    // Validate addons exist and belong to this project
    const validAddons = await db.addon.findMany({
      where: {
        id: { in: addonIds },
        projectId: pledge.projectId,
      },
    });

    if (validAddons.length !== addonIds.length) {
      return NextResponse.json(
        { error: "Some addons are invalid" },
        { status: 400 }
      );
    }

    // Check addon availability
    for (const addon of validAddons) {
      if (addon.quantityAvailable !== null && addon.quantityClaimed >= addon.quantityAvailable) {
        return NextResponse.json(
          { error: `${addon.title} is sold out` },
          { status: 400 }
        );
      }
    }

    // Calculate the expected amount
    const calculatedAmount = validAddons.reduce((sum: number, addon: { amount: number }) => sum + addon.amount, 0);

    // Allow some tolerance for shipping costs
    if (amount < calculatedAmount) {
      return NextResponse.json(
        { error: "Amount is less than addon total" },
        { status: 400 }
      );
    }

    // Create Stripe PaymentIntent for immediate charge
    const stripe = await getStripeInstance();
    if (!stripe) {
      return NextResponse.json(
        { error: "Payment system unavailable" },
        { status: 500 }
      );
    }

    // Create the payment intent
    const paymentIntentParams: {
      amount: number;
      currency: string;
      metadata: {
        pledgeId: string;
        userId: string;
        projectId: string;
        type: string;
        addonIds: string;
      };
      application_fee_amount?: number;
      transfer_data?: { destination: string };
    } = {
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      metadata: {
        pledgeId: pledge.id,
        userId: session.user.id,
        projectId: pledge.projectId,
        type: "additional_items",
        addonIds: JSON.stringify(addonIds),
      },
    };

    // If creator has Stripe Connect, send funds directly to them
    if (pledge.project.stripeConnectId) {
      const feePercent = 0.05; // 5% platform fee
      const applicationFee = Math.round(amount * 100 * feePercent);
      paymentIntentParams.application_fee_amount = applicationFee;
      paymentIntentParams.transfer_data = {
        destination: pledge.project.stripeConnectId,
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Store the additional items purchase info in the pledge metadata
    // We'll complete the addon associations when the payment succeeds via webhook
    await db.pledge.update({
      where: { id: pledge.id },
      data: {
        // Store pending additional items info
        metadata: {
          ...(typeof pledge.metadata === "object" && pledge.metadata !== null ? pledge.metadata : {}),
          pendingAdditionalItems: {
            paymentIntentId: paymentIntent.id,
            addonIds,
            amount,
            createdAt: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      type: "payment_intent",
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Error adding items to pledge:", error);
    return NextResponse.json(
      { error: "Failed to add items to pledge" },
      { status: 500 }
    );
  }
}
