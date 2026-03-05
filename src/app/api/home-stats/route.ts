import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/home-stats
 * Lightweight endpoint for home page stat polling
 * Returns only the stats shown on the home page, calculated from COMPLETED pledges only
 */
export async function GET() {
  try {
    // Get all active project IDs
    const activeProjects = await db.project.findMany({
      where: {
        status: { in: ["LIVE", "FUNDED", "FAILED"] },
        deletedAt: null,
      },
      select: { id: true, goalAmount: true, endDate: true },
    });

    const projectIds = activeProjects.map(p => p.id);

    // Total pledged from COMPLETED pledges only
    const completedTotal = await db.pledge.aggregate({
      where: {
        projectId: { in: projectIds },
        status: "COMPLETED",
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    const totalPledged = Number(completedTotal._sum.amount || 0);

    // Per-project totals for funded count
    const projectPledgeSums = await db.pledge.groupBy({
      by: ["projectId"],
      where: {
        projectId: { in: projectIds },
        status: "COMPLETED",
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    const pledgeSumByProject = new Map(
      projectPledgeSums.map(p => [p.projectId, Number(p._sum.amount || 0)])
    );

    const projectsFunded = activeProjects.filter(p => {
      const pledged = pledgeSumByProject.get(p.id) || 0;
      return pledged >= Number(p.goalAmount);
    }).length;

    // Success rate from ended projects
    const now = new Date();
    const endedProjects = activeProjects.filter(
      p => p.endDate && new Date(p.endDate) < now
    );
    const successfulEnded = endedProjects.filter(p => {
      const pledged = pledgeSumByProject.get(p.id) || 0;
      return pledged >= Number(p.goalAmount);
    }).length;
    const successRate = endedProjects.length > 0
      ? Math.round((successfulEnded / endedProjects.length) * 100)
      : 0;

    // Backer pool
    const backerPool = await db.user.count({
      where: { deletedAt: null, lockedAt: null },
    });

    // Certified retailers
    const certifiedRetailers = await db.retailer.count({
      where: { status: "APPROVED" },
    }).catch(() => 0);

    return NextResponse.json({
      totalPledged,
      projectsFunded,
      successRate,
      backerPool,
      certifiedRetailers,
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Error fetching home stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
