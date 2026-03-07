import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const rewardsLogger = logger.child({ module: "rewards" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { canUserEditProject } from "@/lib/project-auth";

const createRewardSchema = z.object({
  projectId: z.string(),
  type: z.enum(["TIER", "ADDON"]).default("TIER"),
  title: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  imageUrl: z.string().optional(),
  estimatedDelivery: z.string().optional(),
  shippingType: z.enum(["WORLDWIDE", "SELECTED_COUNTRIES", "NO_SHIPPING"]),
  shippingCountries: z.array(z.string()).default([]),
  shippingCost: z.number().default(0),
  quantityAvailable: z.number().optional(),
  visibility: z.enum(["PUBLIC", "SECRET"]).default("PUBLIC"),
  items: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
  })).default([]),
});

const updateRewardSchema = z.object({
  rewardId: z.string(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  imageUrl: z.string().optional(),
  estimatedDelivery: z.string().optional(),
  shippingType: z.enum(["WORLDWIDE", "SELECTED_COUNTRIES", "NO_SHIPPING"]).optional(),
  shippingCountries: z.array(z.string()).optional(),
  shippingCost: z.number().optional(),
  quantityAvailable: z.number().optional().nullable(),
  visibility: z.enum(["PUBLIC", "SECRET"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createRewardSchema.parse(body);

    // Verify project ownership or collaborator with edit permission
    const project = await db.project.findUnique({
      where: { id: data.projectId },
      select: { creatorId: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const canEdit = await canUserEditProject(data.projectId, session.user.id, project.creatorId);
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Allow adding new rewards even for live projects
    // (creators should be able to add stretch goals, etc.)
    if (project.status === "CANCELLED" || project.status === "FAILED") {
      return NextResponse.json(
        { error: "Cannot add rewards to cancelled or failed projects" },
        { status: 400 }
      );
    }

    const { items, ...rewardData } = data;

    const reward = await db.reward.create({
      data: {
        ...rewardData,
        estimatedDelivery: rewardData.estimatedDelivery
          ? new Date(rewardData.estimatedDelivery)
          : null,
        items: {
          create: items,
        },
      },
      include: { items: true, _count: { select: { pledges: true } } },
    });

    return NextResponse.json({ reward }, { status: 201 });
  } catch (error) {
    rewardsLogger.error({ err: String(error) }, "Create reward error:");
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create reward" },
      { status: 500 }
    );
  }
}

// PATCH - Update a reward (with locking logic for live campaigns)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = updateRewardSchema.parse(body);

    // Get the reward with project info
    const reward = await db.reward.findUnique({
      where: { id: data.rewardId },
      include: {
        project: { select: { id: true, creatorId: true, status: true } },
        _count: { select: { pledges: true } },
      },
    });

    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    const canEdit = await canUserEditProject(reward.project.id, session.user.id, reward.project.creatorId);
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isLive = reward.project.status === "LIVE" || reward.project.status === "FUNDED";
    const hasBackers = reward._count.pledges > 0;

    // If project is live and reward has backers, block editing
    if (isLive && hasBackers) {
      return NextResponse.json(
        {
          error: "Cannot edit reward with backers. End this reward and create a new one instead.",
          hasBackers: true,
          backerCount: reward._count.pledges,
        },
        { status: 400 }
      );
    }

    // If reward is already ended, block editing
    if (reward.isEnded) {
      return NextResponse.json(
        { error: "Cannot edit an ended reward" },
        { status: 400 }
      );
    }

    const { rewardId, ...updateData } = data;

    const updatedReward = await db.reward.update({
      where: { id: rewardId },
      data: {
        ...updateData,
        estimatedDelivery: updateData.estimatedDelivery
          ? new Date(updateData.estimatedDelivery)
          : undefined,
      },
      include: { items: true, _count: { select: { pledges: true } } },
    });

    return NextResponse.json({ reward: updatedReward });
  } catch (error) {
    rewardsLogger.error({ err: String(error) }, "Update reward error:");
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update reward" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a reward (only if no backers, otherwise must end it)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rewardId = searchParams.get("rewardId");

    if (!rewardId) {
      return NextResponse.json({ error: "Reward ID required" }, { status: 400 });
    }

    // Get the reward with project info
    const reward = await db.reward.findUnique({
      where: { id: rewardId },
      include: {
        project: { select: { id: true, creatorId: true, status: true } },
        _count: { select: { pledges: true } },
      },
    });

    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    const canEdit = await canUserEditProject(reward.project.id, session.user.id, reward.project.creatorId);
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If reward has backers, cannot delete - must end instead
    if (reward._count.pledges > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete reward with backers. End the reward instead.",
          hasBackers: true,
          backerCount: reward._count.pledges,
        },
        { status: 400 }
      );
    }

    await db.$transaction([
      db.pledgeAddon.deleteMany({ where: { addonId: rewardId } }),
      db.rewardItem.deleteMany({ where: { rewardId } }),
      db.reward.delete({ where: { id: rewardId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    rewardsLogger.error({ err: String(error) }, "Delete reward error:");
    return NextResponse.json(
      { error: "Failed to delete reward" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID required" },
        { status: 400 }
      );
    }

    // Include backer count for each reward
    const rewards = await db.reward.findMany({
      where: { projectId },
      include: {
        items: true,
        _count: { select: { pledges: true } },
      },
      orderBy: [{ type: "asc" }, { amount: "asc" }],
    });

    // Also get project status to determine if campaign is live
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });

    return NextResponse.json({
      rewards,
      projectStatus: project?.status,
      isLive: project?.status === "LIVE" || project?.status === "FUNDED",
    });
  } catch (error) {
    rewardsLogger.error({ err: String(error) }, "Get rewards error:");
    return NextResponse.json(
      { error: "Failed to fetch rewards" },
      { status: 500 }
    );
  }
}
