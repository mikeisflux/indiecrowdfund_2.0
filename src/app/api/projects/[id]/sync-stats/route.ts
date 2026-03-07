import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const projectsSyncStatsLogger = logger.child({ module: "projects-sync-stats" });
import { db } from "@/lib/db";

/**
 * POST /api/projects/[id]/sync-stats
 *
 * Manually sync project stats based on actual pledge data.
 * This is a fallback for when webhooks fail or are delayed.
 *
 * Counting rules:
 * - LIVE + not met goal: COMPLETED + committed pending
 * - LIVE + met goal, FUNDED, FAILED: COMPLETED only
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, currentAmount: true, backerCount: true, goalAmount: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const goalAmount = Number(project.goalAmount);

    // Always get COMPLETED pledge totals
    const completedStats = await db.pledge.aggregate({
      where: {
        projectId,
        status: "COMPLETED",
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    let actualAmount = Number(completedStats._sum.amount || 0);
    let actualBackerCount = completedStats._count.id || 0;

    // For LIVE projects that haven't met goal, also count confirmed pending pledges
    // confirmationEmailSent = true means checkout was completed and card was stored
    if (project.status === "LIVE" && actualAmount < goalAmount) {
      const pendingStats = await db.pledge.aggregate({
        where: {
          projectId,
          status: "PENDING",
          deletedAt: null,
          confirmationEmailSent: true,
        },
        _sum: { amount: true },
        _count: { id: true },
      });

      actualAmount += Number(pendingStats._sum.amount || 0);
      actualBackerCount += (pendingStats._count.id || 0);
    }

    // Check if update is needed
    if (
      Number(project.currentAmount) === actualAmount &&
      project.backerCount === actualBackerCount
    ) {
      return NextResponse.json({
        message: "Stats already in sync",
        currentAmount: actualAmount,
        backerCount: actualBackerCount,
        updated: false,
      });
    }

    // Update the project with correct stats
    const updatedProject = await db.project.update({
      where: { id: projectId },
      data: {
        currentAmount: actualAmount,
        backerCount: actualBackerCount,
      },
      select: {
        id: true,
        currentAmount: true,
        backerCount: true,
        goalAmount: true,
      },
    });

    projectsSyncStatsLogger.info(`[Sync] Project ${projectId} stats synced: $${actualAmount} from ${actualBackerCount} backers (was $${project.currentAmount} from ${project.backerCount})`);

    return NextResponse.json({
      message: "Stats synced successfully",
      previousAmount: Number(project.currentAmount),
      previousBackerCount: project.backerCount,
      currentAmount: Number(updatedProject.currentAmount),
      backerCount: updatedProject.backerCount,
      goalAmount: Number(updatedProject.goalAmount),
      updated: true,
    });
  } catch (error) {
    projectsSyncStatsLogger.error({ err: String(error) }, "Failed to sync project stats:");
    return NextResponse.json(
      { error: "Failed to sync project stats" },
      { status: 500 }
    );
  }
}
