import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { createStripePayment } from "@/lib/payments/stripe";
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

    // Check reward availability (skip if pledging without reward)
    let reward = null;
    if (data.rewardId && data.rewardId !== "no-reward") {
      reward = await db.reward.findUnique({
        where: { id: data.rewardId },
      });

      if (!reward || reward.projectId !== data.projectId) {
        return NextResponse.json({ error: "Invalid reward" }, { status: 400 });
      }

      if (reward.quantityAvailable !== null &&
          reward.quantityClaimed >= reward.quantityAvailable) {
        return NextResponse.json({ error: "Reward sold out" }, { status: 400 });
      }
    }

    // Create payment via Stripe
    const stripeConfig = project.creator.stripeConfig;
    if (!stripeConfig?.isOnboarded) {
      return NextResponse.json(
        { error: "Creator payment not configured" },
        { status: 400 }
      );
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

    const result = await createStripePayment({
      projectId: data.projectId,
      rewardId: data.rewardId,
      addons: addonsWithQuantity,
      amount: data.amount,
      userId: session.user.id,
      sourceCampaignId,
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
      return NextResponse.json({ error: error.issues }, { status: 400 });
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
      ? { userId: session.user.id, projectId }
      : { userId: session.user.id };

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

    return NextResponse.json({ pledges });
  } catch (error) {
    console.error("Get pledges error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pledges" },
      { status: 500 }
    );
  }
}
