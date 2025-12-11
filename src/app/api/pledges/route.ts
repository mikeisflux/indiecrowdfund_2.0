import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { createStripePayment } from "@/lib/payments/stripe";

const createPledgeSchema = z.object({
  projectId: z.string(),
  rewardId: z.string().nullable().optional(), // Optional for "pledge without reward"
  addonIds: z.array(z.string()).default([]),
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

    const result = await createStripePayment({
      projectId: data.projectId,
      rewardId: data.rewardId,
      addonIds: data.addonIds,
      amount: data.amount,
      userId: session.user.id,
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
