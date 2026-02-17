import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { createStripePayment, checkAndUpdateStripeOnboarding } from "@/lib/payments/stripe";
import { getDivinityCoinConfig } from "@/lib/payments/divinitycoin";
import { cookies } from "next/headers";

// Cookie name for campaign attribution (must match click tracking)
const CAMPAIGN_COOKIE_NAME = "ec_source";

// Addon with quantity schema
const addonWithQuantitySchema = z.object({
  id: z.string(),
  quantity: z.number().int().positive(),
});

const createPledgeSchema = z.object({
  projectId: z.string(),
  rewardId: z.string().nullable().optional(), // Optional for "pledge without reward"
  // Support both array of IDs (legacy) and array of objects with quantities
  addonIds: z.array(z.string()).default([]),
  addons: z.array(addonWithQuantitySchema).optional(), // New format with quantities
  amount: z.number().positive(),
  shippingAmount: z.number().min(0).optional(), // Shipping cost
  shippingCountry: z.string().optional(), // Country code for shipping
  shippingAddress: z.object({
    name: z.string(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
    phone: z.string().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createPledgeSchema.parse(body);

    // Get project to determine payment processor
    const project = await db.project.findUnique({
      where: { id: data.projectId },
      include: {
        creator: {
          include: {
            stripeConfig: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.status !== "LIVE") {
      return NextResponse.json(
        { error: "Project is not accepting pledges" },
        { status: 400 }
      );
    }

    // Check if project has ended
    if (project.endDate && new Date(project.endDate) < new Date()) {
      return NextResponse.json(
        { error: "This campaign has ended and is no longer accepting pledges" },
        { status: 400 }
      );
    }

    // Validate reward exists and belongs to project (without quantity check - that happens atomically later)
    let reward = null;
    if (data.rewardId && data.rewardId !== "no-reward") {
      reward = await db.reward.findUnique({
        where: { id: data.rewardId },
      });

      if (!reward || reward.projectId !== data.projectId) {
        return NextResponse.json({ error: "Invalid reward" }, { status: 400 });
      }

      // Quick pre-check for sold out (actual atomic check happens during pledge creation)
      if (reward.quantityAvailable !== null &&
          reward.quantityClaimed >= reward.quantityAvailable) {
        return NextResponse.json({ error: "Reward sold out" }, { status: 400 });
      }
    }

    // Use the new addons format if provided, otherwise convert legacy addonIds
    const addonsWithQuantity = data.addons || data.addonIds.map(id => ({ id, quantity: 1 }));

    // Check for campaign attribution cookie
    let sourceCampaignId: string | undefined;
    try {
      const cookieStore = await cookies();
      const attributionCookie = cookieStore.get(CAMPAIGN_COOKIE_NAME);
      if (attributionCookie?.value) {
        const attributionData = JSON.parse(
          Buffer.from(attributionCookie.value, "base64").toString("utf-8")
        );
        sourceCampaignId = attributionData.campaignId;
        console.log(`Pledge attribution: campaign=${sourceCampaignId}`);
      }
    } catch (e) {
      // Cookie parsing failed, continue without attribution
      console.warn("Failed to parse campaign attribution cookie:", e);
    }

    // Check payment processor and route accordingly
    if (project.paymentProcessor === "DIVINITYCOIN") {
      // Check for existing COMPLETED pledge (user already backed this project)
      const completedPledge = await db.pledge.findFirst({
        where: {
          userId: session.user.id,
          projectId: data.projectId,
          paymentProcessor: "DIVINITYCOIN",
          status: "COMPLETED",
        },
      });

      if (completedPledge) {
        return NextResponse.json(
          { error: "You have already backed this project" },
          { status: 400 }
        );
      }

      // Delete any existing PENDING pledges for this user/project
      // This ensures we start fresh instead of reusing stale data
      const pendingPledges = await db.pledge.findMany({
        where: {
          userId: session.user.id,
          projectId: data.projectId,
          paymentProcessor: "DIVINITYCOIN",
          status: "PENDING",
        },
        select: { id: true },
      });

      if (pendingPledges.length > 0) {
        const pendingIds = pendingPledges.map(p => p.id);
        console.log("[DivinityCoin Pledge] Cleaning up old PENDING pledges:", pendingIds);

        // Delete addons first (foreign key constraint)
        await db.pledgeAddon.deleteMany({
          where: { pledgeId: { in: pendingIds } },
        });

        // Delete the pending pledges
        await db.pledge.deleteMany({
          where: { id: { in: pendingIds } },
        });
      }

      // Calculate reward amount - ensure it's a valid number
      const rewardAmountValue = reward ? Number(reward.amount) : 0;
      const rewardAmount = isNaN(rewardAmountValue) ? 0 : rewardAmountValue;

      // Calculate addons amount
      const addonIds = addonsWithQuantity.map(a => a.id);
      const addonRecords = addonIds.length > 0 ? await db.reward.findMany({
        where: { id: { in: addonIds } },
        select: { id: true, amount: true },
      }) : [];
      const addonAmountMap = new Map(addonRecords.map(a => [a.id, Number(a.amount)]));
      const addonsAmountValue = addonsWithQuantity.reduce((sum, addon) => {
        return sum + (addonAmountMap.get(addon.id) || 0) * addon.quantity;
      }, 0);
      const addonsAmount = isNaN(addonsAmountValue) ? 0 : addonsAmountValue;

      const shippingAmount = data.shippingAmount || 0;

      console.log("[DivinityCoin Pledge] Creating NEW pledge:", {
        userId: session.user.id,
        projectId: data.projectId,
        rewardId: data.rewardId,
        amount: data.amount,
        rewardAmount,
        addonsAmount,
        shippingAmount,
        shippingCountry: data.shippingCountry,
      });

      // For DivinityCoin projects, create a pending pledge and call DC's API
      const pledge = await db.pledge.create({
        data: {
          userId: session.user.id,
          projectId: data.projectId,
          rewardId: data.rewardId && data.rewardId !== "no-reward" ? data.rewardId : null,
          amount: data.amount,
          rewardAmount,
          addonsAmount,
          shippingAmount,
          status: "PENDING",
          paymentProcessor: "DIVINITYCOIN",
          chargedImmediately: true, // DC always charges immediately (uses holds for unfunded)
          ...(sourceCampaignId ? { sourceCampaignId } : {}),
        },
      });

      // Create addon purchases if any
      if (addonsWithQuantity.length > 0) {
        await db.pledgeAddon.createMany({
          data: addonsWithQuantity.map(addon => ({
            pledgeId: pledge.id,
            addonId: addon.id,
            quantity: addon.quantity,
            amount: (addonAmountMap.get(addon.id) || 0) * addon.quantity,
          })),
        });
      }

      // Call DivinityCoin API to create a payment intent
      // DC creates a Stripe PaymentIntent on their account and returns the client_secret
      try {
        const dcConfig = await getDivinityCoinConfig();
        const userRecord = await db.user.findUnique({
          where: { id: session.user.id },
          select: { email: true, name: true },
        });

        const dcResponse = await fetch(`${dcConfig.baseUrl}?action=create-payment-intent`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${dcConfig.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: Math.round(data.amount * 100), // cents
            currency: "usd",
            platformUserId: session.user.id,
            email: userRecord?.email || "",
            name: userRecord?.name || "",
            pledgeId: pledge.id,
            projectId: data.projectId,
          }),
        });

        const dcResult = await dcResponse.json();
        if (!dcResponse.ok || !dcResult.success) {
          console.error("[DivinityCoin Pledge] Failed to create payment intent:", dcResult);
          // Clean up the pledge we just created
          await db.pledgeAddon.deleteMany({ where: { pledgeId: pledge.id } });
          await db.pledge.delete({ where: { id: pledge.id } });
          return NextResponse.json(
            { error: dcResult.error || "Failed to initialize payment" },
            { status: 502 }
          );
        }

        // Store DC's payment intent ID on pledge
        await db.pledge.update({
          where: { id: pledge.id },
          data: { divinityCoinPaymentId: dcResult.paymentIntentId },
        });

        return NextResponse.json({
          paymentMethod: "DIVINITYCOIN",
          type: "payment_intent",
          clientSecret: dcResult.clientSecret,
          publishableKey: dcResult.publishableKey,
          pledgeId: pledge.id,
          chargedImmediately: true,
        });
      } catch (dcError) {
        console.error("[DivinityCoin Pledge] API error:", dcError);
        // Clean up the pledge
        await db.pledgeAddon.deleteMany({ where: { pledgeId: pledge.id } });
        await db.pledge.delete({ where: { id: pledge.id } });
        return NextResponse.json(
          { error: "Failed to connect to payment processor" },
          { status: 502 }
        );
      }
    }

    // For Stripe projects, verify creator has Stripe configured
    const stripeConfig = project.creator.stripeConfig;
    if (!stripeConfig?.stripeAccountId) {
      return NextResponse.json(
        { error: "Creator payment not configured" },
        { status: 400 }
      );
    }

    // Check onboarding status - query Stripe directly if DB shows not onboarded (webhook might be delayed)
    const isOnboarded = await checkAndUpdateStripeOnboarding(
      stripeConfig.id,
      stripeConfig.stripeAccountId,
      stripeConfig.isOnboarded
    );

    if (!isOnboarded) {
      return NextResponse.json(
        { error: "Creator payment not fully configured" },
        { status: 400 }
      );
    }

    const result = await createStripePayment({
      projectId: data.projectId,
      rewardId: data.rewardId,
      addons: addonsWithQuantity,
      amount: data.amount,
      userId: session.user.id,
      sourceCampaignId,
      shippingAmount: data.shippingAmount || 0,
      shippingCountry: data.shippingCountry,
    });

    return NextResponse.json({
      paymentMethod: "STRIPE",
      type: result.type, // "payment_intent" or "setup_intent"
      clientSecret: result.clientSecret,
      pledgeId: result.pledgeId,
      chargedImmediately: result.chargedImmediately,
    });
  } catch (error) {
    console.error("Create pledge error:", error);
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create pledge" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    const where = projectId
      ? { userId: session.user.id, projectId, deletedAt: null }
      : { userId: session.user.id, deletedAt: null };

    const pledges = await db.pledge.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
          },
        },
        reward: {
          select: {
            id: true,
            title: true,
            amount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Convert Decimal fields to numbers for JSON serialization
    const serializedPledges = pledges.map(pledge => ({
      ...pledge,
      amount: Number(pledge.amount),
      reward: pledge.reward ? {
        ...pledge.reward,
        amount: Number(pledge.reward.amount),
      } : null,
    }));

    return NextResponse.json({ pledges: serializedPledges });
  } catch (error) {
    console.error("Get pledges error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pledges" },
      { status: 500 }
    );
  }
}
