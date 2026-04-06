import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const rewardsEndLogger = logger.child({ module: "rewards-end" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canUserEditProject } from "@/lib/project-auth";

// POST - End a reward (marks it as ended so no new backers can select it)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rewardId = id;

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

    // Only allow ending rewards for live/funded projects
    if (!["LIVE", "FUNDED"].includes(reward.project.status)) {
      return NextResponse.json(
        { error: "Can only end rewards for live campaigns" },
        { status: 400 }
      );
    }

    // Check if already ended
    if (reward.isEnded) {
      return NextResponse.json(
        { error: "Reward is already ended" },
        { status: 400 }
      );
    }

    // End the reward
    const updatedReward = await db.reward.update({
      where: { id: rewardId },
      data: {
        isEnded: true,
        endedAt: new Date(),
      },
      include: { items: true, _count: { select: { pledges: true } } },
    });

    return NextResponse.json({
      success: true,
      reward: updatedReward,
      message: `${reward.type === "TIER" ? "Reward" : "Add-on"} has been ended. Existing backers will still receive it, but no new backers can select it.`,
    });
  } catch (error) {
    rewardsEndLogger.error({ err: String(error) }, "End reward error:");
    return NextResponse.json(
      { error: "Failed to end reward" },
      { status: 500 }
    );
  }
}
