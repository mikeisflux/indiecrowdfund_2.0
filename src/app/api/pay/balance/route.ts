import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe/config";

// GET - Fetch balance payment details by token
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Find pledge with this payment token
    const pledges = await db.pledge.findMany({
      where: {
        status: "COMPLETED",
        deletedAt: null,
        metadata: {
          path: ["balancePaymentToken"],
          equals: token,
        },
      },
      include: {
        user: { select: { name: true, email: true } },
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            paymentProcessor: true,
            creatorId: true,
          },
        },
        reward: { select: { title: true, amount: true } },
        addons: {
          include: { addon: { select: { title: true, amount: true } } },
        },
      },
    });

    if (pledges.length === 0) {
      return NextResponse.json({ error: "Invalid or expired payment link" }, { status: 404 });
    }

    const pledge = pledges[0];
    const meta = (pledge.metadata as Record<string, unknown>) || {};

    // Check token expiry
    const expiryStr = meta.balancePaymentTokenExpiry as string | undefined;
    if (expiryStr && new Date(expiryStr) < new Date()) {
      return NextResponse.json({ error: "This payment link has expired" }, { status: 410 });
    }

    // Check if already paid
    if (meta.balancePaymentCompletedAt) {
      return NextResponse.json({ error: "This balance has already been paid" }, { status: 410 });
    }

    // Calculate balance due - prefer stored value from creator's order edit
    const storedBalanceDue = meta.balanceDueAmount != null ? Number(meta.balanceDueAmount) : null;
    const pledgeTotal = Number(pledge.amount);
    const expectedTotal = Number(pledge.rewardAmount) + Number(pledge.addonsAmount) + Number(pledge.shippingAmount);
    const balanceDue = storedBalanceDue !== null
      ? Math.max(0, Math.round(storedBalanceDue * 100) / 100)
      : Math.max(0, Math.round((expectedTotal - pledgeTotal) * 100) / 100);

    if (balanceDue <= 0) {
      return NextResponse.json({ error: "No balance due" }, { status: 400 });
    }

    return NextResponse.json({
      pledgeId: pledge.id,
      projectTitle: pledge.project.title,
      projectSlug: pledge.project.slug,
      backerName: pledge.user.name || "Backer",
      paymentProcessor: pledge.project.paymentProcessor || "STRIPE",
      balanceDue,
      reward: pledge.reward ? { title: pledge.reward.title, amount: Number(pledge.reward.amount) } : null,
      addons: pledge.addons.map((a: { addon: { title: string; amount: unknown }; quantity: number }) => ({
        title: a.addon.title,
        quantity: a.quantity,
        amount: Number(a.addon.amount),
      })),
      shippingAmount: Number(pledge.shippingAmount),
      originalAmount: pledgeTotal,
    });
  } catch (error) {
    console.error("Error fetching balance details:", error);
    return NextResponse.json({ error: "Failed to load payment details" }, { status: 500 });
  }
}

// POST - Create a payment intent for the balance
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Find pledge with this payment token
    const pledges = await db.pledge.findMany({
      where: {
        status: "COMPLETED",
        deletedAt: null,
        metadata: {
          path: ["balancePaymentToken"],
          equals: token,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            paymentProcessor: true,
            creatorId: true,
          },
        },
        user: { select: { id: true, email: true } },
      },
    });

    if (pledges.length === 0) {
      return NextResponse.json({ error: "Invalid or expired payment link" }, { status: 404 });
    }

    const pledge = pledges[0];
    const meta = (pledge.metadata as Record<string, unknown>) || {};

    // Check token expiry
    const expiryStr = meta.balancePaymentTokenExpiry as string | undefined;
    if (expiryStr && new Date(expiryStr) < new Date()) {
      return NextResponse.json({ error: "Payment link expired" }, { status: 410 });
    }

    // Check if already paid
    if (meta.balancePaymentCompletedAt) {
      return NextResponse.json({ error: "Balance already paid" }, { status: 410 });
    }

    // Calculate balance due - prefer stored value from creator's order edit
    const storedBalanceDue = meta.balanceDueAmount != null ? Number(meta.balanceDueAmount) : null;
    const pledgeTotal = Number(pledge.amount);
    const expectedTotal = Number(pledge.rewardAmount) + Number(pledge.addonsAmount) + Number(pledge.shippingAmount);
    const balanceDue = storedBalanceDue !== null
      ? Math.max(0, Math.round(storedBalanceDue * 100) / 100)
      : Math.max(0, Math.round((expectedTotal - pledgeTotal) * 100) / 100);

    if (balanceDue <= 0) {
      return NextResponse.json({ error: "No balance due" }, { status: 400 });
    }

    if (pledge.project.paymentProcessor === "STRIPE") {
      // Get the creator's Stripe Connect account
      const stripeConfig = await db.stripeConfig.findFirst({
        where: { userId: pledge.project.creatorId, isActive: true },
      });

      if (!stripeConfig) {
        return NextResponse.json({ error: "Payment processing not available" }, { status: 500 });
      }

      const stripe = await getStripeInstance();
      const amountInCents = Math.round(balanceDue * 100);
      const platformFee = Math.round(balanceDue * 0.03 * 100); // 3% platform fee

      // Create a PaymentIntent for the balance amount
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        application_fee_amount: platformFee,
        transfer_data: {
          destination: stripeConfig.stripeAccountId,
        },
        metadata: {
          pledgeId: pledge.id,
          projectId: pledge.project.id,
          type: "balance_payment",
          balancePaymentToken: token,
        },
      });

      // Store the payment intent ID in pledge metadata
      await db.pledge.update({
        where: { id: pledge.id },
        data: {
          metadata: {
            ...meta,
            balancePaymentIntentId: paymentIntent.id,
          },
        },
      });

      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        paymentProcessor: "STRIPE",
        amount: balanceDue,
      });
    } else if (pledge.project.paymentProcessor === "DIVINITYCOIN") {
      // For DivinityCoin, create payment through their API
      const settings = await db.platformSettings.findFirst();
      const dcApiKey = settings?.divinityCoinApiKey;
      const dcBaseUrl = settings?.divinityCoinBaseUrl || "https://api.divinitycoin.com";

      if (!dcApiKey) {
        return NextResponse.json({ error: "DivinityCoin not configured" }, { status: 500 });
      }

      const amountInCents = Math.round(balanceDue * 100);

      const dcResponse = await fetch(`${dcBaseUrl}?action=create-payment-intent`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${dcApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountInCents,
          currency: "usd",
          platformUserId: pledge.user.id,
          email: pledge.user.email || "",
          pledgeId: pledge.id,
          metadata: {
            type: "balance_payment",
            balancePaymentToken: token,
            projectId: pledge.project.id,
          },
        }),
      });

      if (!dcResponse.ok) {
        console.error("DivinityCoin API error:", await dcResponse.text());
        return NextResponse.json({ error: "Payment processing failed" }, { status: 500 });
      }

      const dcData = await dcResponse.json();

      await db.pledge.update({
        where: { id: pledge.id },
        data: {
          metadata: {
            ...meta,
            balanceDivinityCoinPaymentId: dcData.paymentId,
          },
        },
      });

      return NextResponse.json({
        clientSecret: dcData.clientSecret,
        publishableKey: dcData.publishableKey,
        paymentProcessor: "DIVINITYCOIN",
        amount: balanceDue,
        divinityCoinPaymentId: dcData.paymentId,
      });
    }

    return NextResponse.json({ error: "Unknown payment processor" }, { status: 400 });
  } catch (error) {
    console.error("Error creating balance payment:", error);
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
