import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/projects/[id]/sync-stats
 *
 * Manually sync project stats based on actual pledge data.
 * This is a fallback for when webhooks fail or are delayed.
 *
 * Recalculates currentAmount and backerCount from actual COMPLETED pledges
 * and PENDING pledges that have saved payment methods (committed backers).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Get the project
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, currentAmount: true, backerCount: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Calculate actual stats from pledges
    // Count COMPLETED pledges + CONFIRMED PENDING pledges (checkout completed)
    const pledgeStats = await db.pledge.aggregate({
      where: {
        projectId,
        OR: [
          { status: "COMPLETED" },
          {
            status: "PENDING",
            stripePaymentMethodId: { not: null },
            confirmationEmailSent: true, // Only count confirmed checkouts
          },
        ],
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const actualAmount = pledgeStats._sum.amount || 0;
    const actualBackerCount = pledgeStats._count.id || 0;

    // Check if update is needed
    if (
      project.currentAmount === actualAmount &&
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

    console.log(
      `[Sync] Project ${projectId} stats synced: $${actualAmount} from ${actualBackerCount} backers (was $${project.currentAmount} from ${project.backerCount})`
    );

    return NextResponse.json({
      message: "Stats synced successfully",
      previousAmount: project.currentAmount,
      previousBackerCount: project.backerCount,
      currentAmount: updatedProject.currentAmount,
      backerCount: updatedProject.backerCount,
      goalAmount: updatedProject.goalAmount,
      updated: true,
    });
  } catch (error) {
    console.error("Failed to sync project stats:", error);
    return NextResponse.json(
      { error: "Failed to sync project stats" },
      { status: 500 }
    );
  }
}
