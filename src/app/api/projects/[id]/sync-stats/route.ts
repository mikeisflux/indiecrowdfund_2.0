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
    // Count COMPLETED pledges + PENDING pledges that completed checkout
    // A pledge counts if:
    // - Status is COMPLETED (already charged)
    // - Status is PENDING with saved payment method (ready to charge when funded)
    // - Status is PENDING with SetupIntent (user completed checkout flow)
    // - Status is PENDING with confirmationEmailSent (explicitly confirmed)
    const pledgeStats = await db.pledge.aggregate({
      where: {
        projectId,
        OR: [
          { status: "COMPLETED" },
          {
            // Pending pledges with saved payment method
            status: "PENDING",
            stripePaymentMethodId: { not: null },
          },
          {
            // Pending pledges with SetupIntent (user completed checkout)
            status: "PENDING",
            stripeSetupIntentId: { not: null },
          },
          {
            // Explicitly confirmed pending pledges
            status: "PENDING",
            confirmationEmailSent: true,
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
      previousAmount: Number(project.currentAmount),
      previousBackerCount: project.backerCount,
      currentAmount: Number(updatedProject.currentAmount),
      backerCount: updatedProject.backerCount,
      goalAmount: Number(updatedProject.goalAmount),
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
