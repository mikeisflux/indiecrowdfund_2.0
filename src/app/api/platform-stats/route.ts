import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Force dynamic rendering - this route needs database access
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get total funded projects count
    const fundedProjectsCount = await db.project.count({
      where: {
        status: "FUNDED",
      },
    }).catch(() => 0);

    // Get total live projects count
    const liveProjectsCount = await db.project.count({
      where: {
        status: "LIVE",
      },
    }).catch(() => 0);

    // Get total projects (excluding drafts)
    const totalProjectsCount = await db.project.count({
      where: {
        status: {
          not: "DRAFT",
        },
      },
    }).catch(() => 0);

    // Get total raised (sum of currentAmount for funded projects)
    const fundedProjects = await db.project.aggregate({
      _sum: {
        currentAmount: true,
      },
      where: {
        status: {
          in: ["FUNDED", "LIVE"],
        },
      },
    }).catch(() => ({ _sum: { currentAmount: 0 } }));
    const totalRaised = fundedProjects?._sum?.currentAmount || 0;

    // Get total backers (unique users who have pledged)
    const totalBackers = await db.pledge.groupBy({
      by: ["userId"],
      where: {
        status: {
          in: ["COMPLETED", "PENDING"],
        },
      },
    }).catch(() => []);
    const uniqueBackersCount = totalBackers?.length || 0;

    // Get total pledges
    const totalPledges = await db.pledge.count({
      where: {
        status: {
          in: ["COMPLETED", "PENDING"],
        },
      },
    }).catch(() => 0);

    // Get total creators (users who have created at least one project)
    const totalCreators = await db.project.groupBy({
      by: ["creatorId"],
      where: {
        status: {
          not: "DRAFT",
        },
      },
    }).catch(() => []);
    const uniqueCreatorsCount = totalCreators?.length || 0;

    // Get total users
    const totalUsers = await db.user.count().catch(() => 0);

    // Get categories with project counts
    const categoryCounts = await db.project.groupBy({
      by: ["category"],
      _count: {
        id: true,
      },
      where: {
        status: {
          in: ["LIVE", "FUNDED"],
        },
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
    }).catch(() => []);

    return NextResponse.json({
      projectsFunded: fundedProjectsCount,
      projectsLive: liveProjectsCount,
      projectsTotal: totalProjectsCount,
      totalRaised,
      totalBackers: uniqueBackersCount,
      totalPledges,
      totalCreators: uniqueCreatorsCount,
      totalUsers,
      categoryCounts: (categoryCounts || []).map((c) => ({
        category: c.category,
        count: c._count?.id || 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching platform stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch platform stats" },
      { status: 500 }
    );
  }
}
