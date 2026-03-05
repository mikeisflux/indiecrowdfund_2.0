import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/projects/vanity/[vanityname]/[slug]/stats
 * Lightweight endpoint to fetch just funding stats for real-time updates
 *
 * Counting rules:
 * - LIVE + not met goal: Count COMPLETED + committed pending (payments not yet charged)
 * - LIVE + met goal, FUNDED, FAILED: Count only COMPLETED pledges
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vanityname: string; slug: string }> }
) {
  try {
    const { vanityname, slug } = await params;

    const creator = await db.user.findUnique({
      where: { vanityUrl: vanityname },
      select: { id: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const project = await db.project.findFirst({
      where: {
        slug,
        creatorId: creator.id,
      },
      select: {
        id: true,
        currentAmount: true,
        backerCount: true,
        goalAmount: true,
        status: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const goalAmount = Number(project.goalAmount);

    // Always get COMPLETED pledge totals
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
    // confirmationEmailSent = true means checkout was completed and card was stored
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

    return NextResponse.json({
      currentAmount: actualAmount,
      backerCount: actualBackerCount,
      goalAmount,
      fundingPercentage: (actualAmount / goalAmount) * 100,
      status: project.status,
    });
  } catch (error) {
    console.error("Get project stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
