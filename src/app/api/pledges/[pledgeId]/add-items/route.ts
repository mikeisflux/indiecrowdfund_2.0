import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

/**
 * Self-healing function to fix pledges stuck in PENDING status
 * This can happen if the Stripe webhook didn't fire or failed
 */
async function healStuckPendingPledge(pledgeId: string, stripePaymentIntentId: string): Promise<boolean> {
  try {
    const stripe = await getStripeInstance();
    if (!stripe) return false;

    const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

    if (paymentIntent.status === "succeeded") {
      // Payment succeeded but webhook didn't update pledge - fix it now
      const paymentMethodId = typeof paymentIntent.payment_method === "string"
        ? paymentIntent.payment_method
        : paymentIntent.payment_method?.id;

      // Calculate backer number if not already assigned
      const pledge = await db.pledge.findUnique({
        where: { id: pledgeId },
        select: { projectId: true, backerNumber: true },
      });

      let backerNumber = pledge?.backerNumber;
      if (!backerNumber && pledge?.projectId) {
        const existingBackerCount = await db.pledge.count({
          where: {
            projectId: pledge.projectId,
            backerNumber: { not: null },
          },
        });
        backerNumber = existingBackerCount + 1;
      }

      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "COMPLETED",
          stripePaymentMethodId: paymentMethodId,
          backerNumber,
        },
      });

      console.log(`[AddItems] Self-healed pledge ${pledgeId} - updated to COMPLETED`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[AddItems] Failed to heal pledge ${pledgeId}:`, error);
    return false;
  }
}

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
    const { addons, addonIds, amount } = body;

    // Support both new format (addons with quantities) and legacy format (addonIds)
    const addonsWithQuantity: { id: string; quantity: number }[] = addons ||
      (addonIds ? addonIds.map((id: string) => ({ id, quantity: 1 })) : []);

    if (addonsWithQuantity.length === 0) {
      return NextResponse.json(
        { error: "At least one addon is required" },
        { status: 400 }
      );
    }

    const addonIdList = addonsWithQuantity.map(a => a.id);

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    // Get the pledge with project info and creator's Stripe config
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
            stripeAccountId: true,
            creator: {
              select: {
                stripeConfig: {
                  select: {
                    stripeAccountId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    // Verify pledge is completed
    // If PENDING with a PaymentIntent, try to heal it by checking Stripe
    if (pledge.status !== "COMPLETED") {
      if (pledge.status === "PENDING" && pledge.stripePaymentIntentId) {
        // Try to heal stuck pledge by checking PaymentIntent status in Stripe
        const healed = await healStuckPendingPledge(pledgeId, pledge.stripePaymentIntentId);
        if (!healed) {
          return NextResponse.json(
            { error: "Your pledge payment may still be processing. Please try again in a few moments." },
            { status: 400 }
          );
        }
        // Pledge was healed, continue with adding items
      } else {
        return NextResponse.json(
          { error: "Can only add items to completed pledges" },
          { status: 400 }
        );
      }
    }

    // Verify project is still live
    if (pledge.project.status !== "LIVE") {
      return NextResponse.json(
        { error: "Can only add items while the campaign is live" },
        { status: 400 }
      );
    }

    // Validate addons exist and belong to this project (addons are rewards with type ADDON)
    const validAddons = await db.reward.findMany({
      where: {
        id: { in: addonIdList },
        projectId: pledge.projectId,
        type: "ADDON",
      },
    });

    if (validAddons.length !== addonIdList.length) {
      return NextResponse.json(
        { error: "Some addons are invalid" },
        { status: 400 }
      );
    }

    // Create a map for quick lookup
    const addonQuantityMap = new Map(addonsWithQuantity.map(a => [a.id, a.quantity]));

    // Check addon availability with quantities
    for (const addon of validAddons) {
      const requestedQty = addonQuantityMap.get(addon.id) || 1;
      if (addon.quantityAvailable !== null) {
        const availableQty = addon.quantityAvailable - addon.quantityClaimed;
        if (requestedQty > availableQty) {
          return NextResponse.json(
            { error: `Only ${availableQty} of ${addon.title} available` },
            { status: 400 }
          );
        }
      }
    }

    // Calculate the expected amount with quantities
    const calculatedAmount = validAddons.reduce((sum: number, addon: { id: string; amount: number }) => {
      const qty = addonQuantityMap.get(addon.id) || 1;
      return sum + (Number(addon.amount) * qty);
    }, 0);

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
        addons: string;
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
        addons: JSON.stringify(addonsWithQuantity),
      },
    };

    // Get the creator's Stripe account ID (prefer from stripeConfig, fallback to project field)
    const stripeAccountId = pledge.project.creator?.stripeConfig?.stripeAccountId || pledge.project.stripeAccountId;

    // If creator has Stripe Connect, send funds directly to them
    if (stripeAccountId) {
      const feePercent = 0.05; // 5% platform fee
      const applicationFee = Math.round(amount * 100 * feePercent);
      paymentIntentParams.application_fee_amount = applicationFee;
      paymentIntentParams.transfer_data = {
        destination: stripeAccountId,
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Note: The addon data is stored in the PaymentIntent metadata (line 157 above)
    // The webhook handler will use this to complete the addon associations when payment succeeds

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
