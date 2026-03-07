import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const rewardsShippingLogger = logger.child({ module: "rewards-shipping" });
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

const updateShippingSchema = z.object({
  shippingType: z.enum(["NO_SHIPPING", "WORLDWIDE", "SELECTED_COUNTRIES"]),
  shippingCost: z.record(z.string(), z.number()).default({}),
  shippingCountries: z.array(z.string()).default([]),
});

/**
 * Direct shipping update endpoint for rewards
 * Allows updating shipping even on rewards that have backers
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rewardId } = await params;

    // Get the reward and verify ownership
    const reward = await db.reward.findUnique({
      where: { id: rewardId },
      include: {
        project: {
          select: { creatorId: true },
        },
      },
    });

    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    // Check if user is creator or collaborator with edit permission
    const isCreator = reward.project.creatorId === session.user.id;
    let canEdit = isCreator;

    if (!isCreator) {
      const collaborator = await db.projectCollaborator.findFirst({
        where: {
          projectId: reward.projectId,
          userId: session.user.id,
          status: "ACCEPTED",
          canEditProject: true,
        },
      });
      canEdit = !!collaborator;
    }

    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const data = updateShippingSchema.parse(body);

    rewardsShippingLogger.info({ data: {
      rewardId,
      ...data,
    } }, "[Shipping API] Updating reward shipping:");

    // Update just the shipping fields
    const updated = await db.reward.update({
      where: { id: rewardId },
      data: {
        shippingType: data.shippingType,
        shippingCost: data.shippingCost,
        shippingCountries: data.shippingCountries,
      },
    });

    rewardsShippingLogger.info({ data: {
      rewardId: updated.id,
      shippingType: updated.shippingType,
      shippingCost: updated.shippingCost,
      shippingCountries: updated.shippingCountries,
    } }, "[Shipping API] Updated reward shipping:");

    return NextResponse.json({
      success: true,
      reward: {
        id: updated.id,
        shippingType: updated.shippingType,
        shippingCost: updated.shippingCost,
        shippingCountries: updated.shippingCountries,
      },
    });
  } catch (error) {
    rewardsShippingLogger.error({ err: String(error) }, "Update reward shipping error:");
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(i => i.message).join(", ") }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update shipping" }, { status: 500 });
  }
}

/**
 * Get current shipping settings for a reward
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rewardId } = await params;

    const reward = await db.reward.findUnique({
      where: { id: rewardId },
      select: {
        id: true,
        title: true,
        shippingType: true,
        shippingCost: true,
        shippingCountries: true,
        project: {
          select: { creatorId: true },
        },
      },
    });

    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    // Check if user is creator or collaborator
    const isCreator = reward.project.creatorId === session.user.id;
    let canView = isCreator;

    if (!isCreator) {
      const collaborator = await db.projectCollaborator.findFirst({
        where: {
          projectId: reward.projectId,
          userId: session.user.id,
          status: "ACCEPTED",
        },
      });
      canView = !!collaborator;
    }

    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      reward: {
        id: reward.id,
        title: reward.title,
        shippingType: reward.shippingType,
        shippingCost: reward.shippingCost,
        shippingCountries: reward.shippingCountries,
      },
    });
  } catch (error) {
    rewardsShippingLogger.error({ err: String(error) }, "Get reward shipping error:");
    return NextResponse.json({ error: "Failed to get shipping" }, { status: 500 });
  }
}
