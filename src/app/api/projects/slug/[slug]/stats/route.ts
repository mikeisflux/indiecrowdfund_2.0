import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/projects/slug/[slug]/stats
 * Lightweight endpoint to fetch just funding stats for real-time updates
 * Returns only currentAmount and backerCount to minimize data transfer
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

    // Set cache headers for short-term caching (5 seconds)
    // This prevents excessive DB queries while keeping data relatively fresh
    return NextResponse.json(
      {
        currentAmount: project.currentAmount,
        backerCount: project.backerCount,
        goalAmount: project.goalAmount,
        fundingPercentage: (project.currentAmount / project.goalAmount) * 100,
        status: project.status,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=5, stale-while-revalidate=10",
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
