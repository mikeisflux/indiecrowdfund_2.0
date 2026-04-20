import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const payBalanceLogger = logger.child({ module: "pay-balance" });
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe/config";
import { getDivinityCoinConfig } from "@/lib/payments/divinitycoin";

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

    if (pledges.length > 1) {
      payBalanceLogger.error({ pledgeCount: pledges.length }, "Duplicate balance payment tokens found");
      return NextResponse.json({ error: "Invalid payment link" }, { status: 400 });
    }

    const pledge = pledges[0];
    const meta = (pledge.metadata as Record<string, unknown>) || {};

    // Check token expiry — reject tokens without an expiry (should always be set)
    const expiryStr = meta.balancePaymentTokenExpiry as string | undefined;
    if (!expiryStr || new Date(expiryStr) < new Date()) {
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
    payBalanceLogger.error({ err: String(error) }, "Error fetching balance details:");
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
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (pledges.length === 0) {
      return NextResponse.json({ error: "Invalid or expired payment link" }, { status: 404 });
    }

    if (pledges.length > 1) {
      payBalanceLogger.error({ pledgeCount: pledges.length }, "Duplicate balance payment tokens found");
      return NextResponse.json({ error: "Invalid payment link" }, { status: 400 });
    }

    const pledge = pledges[0];
    const meta = (pledge.metadata as Record<string, unknown>) || {};

    // Check token expiry — reject tokens without an expiry (should always be set)
    const expiryStr = meta.balancePaymentTokenExpiry as string | undefined;
    if (!expiryStr || new Date(expiryStr) < new Date()) {
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
      if (!stripe) {
        return NextResponse.json({ error: "Payment system unavailable" }, { status: 500 });
      }
      const platformSettings = await db.platformSettings.findUnique({
        where: { id: "default" },
        select: { platformFee: true },
      });
      const platformFeeRate = platformSettings?.platformFee
        ? Number(platformSettings.platformFee) / 100
        : 0.03;
      const amountInCents = Math.round(balanceDue * 100);
      const platformFee = Math.round(balanceDue * platformFeeRate * 100);

      // Create a PaymentIntent for the balance amount
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
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

      // Store the payment intent ID in pledge metadata. Re-read the
      // metadata inside a FOR UPDATE row lock so a concurrent order
      // edit or balance payment initiation doesn't clobber fields
      // we need to preserve.
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM "Pledge" WHERE id = ${pledge.id} FOR UPDATE`;
        const fresh = await tx.pledge.findUnique({
          where: { id: pledge.id },
          select: { metadata: true },
        });
        const freshMeta = (fresh?.metadata as Record<string, unknown>) || {};
        await tx.pledge.update({
          where: { id: pledge.id },
          data: {
            metadata: {
              ...freshMeta,
              balancePaymentIntentId: paymentIntent.id,
            },
          },
        });
      });

      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        paymentProcessor: "STRIPE",
        amount: balanceDue,
      });
    } else if (pledge.project.paymentProcessor === "DIVINITYCOIN") {
      // For DivinityCoin, create payment through their API
      let dcConfig;
      try {
        dcConfig = await getDivinityCoinConfig();
      } catch {
        return NextResponse.json({ error: "DivinityCoin not configured" }, { status: 500 });
      }

      const amountInCents = Math.round(balanceDue * 100);

      // DC's create-payment-intent requires a unique purchaseId per intent (it
      // uses it as the idempotency key). Reusing the pledgeId fails because
      // DC already has an intent for the original pledge charge. Derive a
      // per-balance purchaseId from the token so repeated clicks on the same
      // payment link are idempotent, but separate from the original pledge.
      const balancePurchaseId = `balance_${token.substring(0, 24)}`;

      // DC's create-payment-intent expects amount/platformUserId/email/pledgeId/
      // projectId at the TOP level (not nested in metadata). Match the
      // marketplace payload shape — projectId/purchaseId/type/statement_descriptor
      // all top-level. Use type "pledge" since DC recognizes that (vs the
      // custom "balance_payment" it didn't accept).
      const dcResponse = await fetch(`${dcConfig.baseUrl}?action=create-payment-intent`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${dcConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountInCents,
          currency: "usd",
          platformUserId: pledge.user.id,
          email: pledge.user.email || "",
          name: pledge.user.name || "",
          pledgeId: pledge.id,
          projectId: pledge.project.id,
          purchaseId: balancePurchaseId,
          type: "pledge",
          statement_descriptor: "INDIECROWDFUND",
          metadata: {
            balancePaymentToken: token,
            balancePayment: true,
            originalPledgeId: pledge.id,
          },
        }),
      });

      if (!dcResponse.ok) {
        const errorText = await dcResponse.text();
        payBalanceLogger.error(
          {
            err: errorText,
            status: dcResponse.status,
            requestBody: {
              amount: amountInCents,
              pledgeId: pledge.id,
              projectId: pledge.project.id,
              purchaseId: balancePurchaseId,
              type: "pledge",
            },
          },
          "[Balance DC] API error:"
        );
        return NextResponse.json({ error: "Payment processing failed" }, { status: 500 });
      }

      const dcData = await dcResponse.json();

      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM "Pledge" WHERE id = ${pledge.id} FOR UPDATE`;
        const fresh = await tx.pledge.findUnique({
          where: { id: pledge.id },
          select: { metadata: true },
        });
        const freshMeta = (fresh?.metadata as Record<string, unknown>) || {};
        await tx.pledge.update({
          where: { id: pledge.id },
          data: {
            metadata: {
              ...freshMeta,
              balanceDivinityCoinPaymentId: dcData.paymentId,
            },
          },
        });
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
    const message = error instanceof Error ? error.message : "Unknown error";
    payBalanceLogger.error({ err: `${message}: ${error}` }, "Error creating balance payment:");
    return NextResponse.json({ error: `Failed to create payment: ${message}` }, { status: 500 });
  }
}
