import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/projects/slug/[slug]/stats
 * Lightweight endpoint to fetch just funding stats for real-time updates
 * Returns only currentAmount and backerCount to minimize data transfer
 *
 * Also auto-syncs stats if they appear to be stale (self-healing)
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

    // Auto-sync: Check if stats match actual pledge data
    // This self-heals when webhooks fail or are delayed
    //
    // Two types of pledges:
    // 1. chargedImmediately: true - Campaign was funded, user charged immediately → COMPLETED
    // 2. chargedImmediately: false - Campaign not funded yet, card saved → PENDING until goal reached
    //
    // Stats should count:
    // - COMPLETED pledges (already charged)
    // - PENDING pledges with chargedImmediately=false (real backers waiting for campaign to fund)
    const pledgeStats = await db.pledge.aggregate({
      where: {
        projectId: project.id,
        OR: [
          { status: "COMPLETED" },
          {
            // PENDING pledges where card was saved for later (campaign not yet funded)
            status: "PENDING",
            chargedImmediately: false,
          },
        ],
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const actualAmount = pledgeStats._sum.amount || 0;
    const actualBackerCount = pledgeStats._count.id || 0;

    // If stats are out of sync, update them
    let currentAmount = project.currentAmount;
    let backerCount = project.backerCount;

    if (project.currentAmount !== actualAmount || project.backerCount !== actualBackerCount) {
      const updated = await db.project.update({
        where: { id: project.id },
        data: {
          currentAmount: actualAmount,
          backerCount: actualBackerCount,
        },
        select: {
          currentAmount: true,
          backerCount: true,
        },
      });
      currentAmount = updated.currentAmount;
      backerCount = updated.backerCount;
      console.log(`[Auto-sync] Project ${project.id} stats corrected: $${actualAmount} from ${actualBackerCount} backers`);
    }

    // No caching - always return fresh data
    return NextResponse.json(
      {
        currentAmount,
        backerCount,
        goalAmount: project.goalAmount,
        fundingPercentage: (currentAmount / project.goalAmount) * 100,
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
