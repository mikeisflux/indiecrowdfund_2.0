import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/projects/slug/[slug]/stats
 * Lightweight endpoint to fetch just funding stats for real-time updates
 * Returns only currentAmount and backerCount to minimize data transfer
 *
 * Counting rules:
 * - LIVE + not met goal: Count COMPLETED + committed pending (payments not yet charged)
 * - LIVE + met goal, FUNDED, FAILED: Count only COMPLETED pledges
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const project = await db.project.findUnique({
      where: { slug },
      select: {
        id: true,
        currentAmount: true,
        backerCount: true,
        goalAmount: true,
        status: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const goalAmount = Number(project.goalAmount);

    // First, always get COMPLETED pledge totals
    const completedStats = await db.pledge.aggregate({
      where: {
        projectId: project.id,
        status: "COMPLETED",
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    let actualAmount = Number(completedStats._sum.amount || 0);
    let actualBackerCount = completedStats._count.id || 0;

    // For LIVE projects that haven't met their goal, also include confirmed pending pledges
    // confirmationEmailSent = true means the backer completed checkout, card was saved,
    // and they approved being charged when the campaign funds. This excludes abandoned carts.
    if (project.status === "LIVE" && actualAmount < goalAmount) {
      const pendingStats = await db.pledge.aggregate({
        where: {
          projectId: project.id,
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

    // Sync stored project fields if they differ
    if (Number(project.currentAmount) !== actualAmount || project.backerCount !== actualBackerCount) {
      await db.project.update({
        where: { id: project.id },
        data: {
          currentAmount: actualAmount,
          backerCount: actualBackerCount,
        },
      });
      console.log(`[Auto-sync] Project ${project.id} stats corrected: $${actualAmount} from ${actualBackerCount} backers`);
    }

    return NextResponse.json(
      {
        currentAmount: actualAmount,
        backerCount: actualBackerCount,
        goalAmount,
        fundingPercentage: (actualAmount / goalAmount) * 100,
        status: project.status,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch project stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch project stats" },
      { status: 500 }
    );
  }
}
