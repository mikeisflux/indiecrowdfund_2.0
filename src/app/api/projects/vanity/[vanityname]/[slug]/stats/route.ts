import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { getProjectStats } from "@/lib/stats";

const projectsVanityStatsLogger = logger.child({ module: "projects-vanity-stats" });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vanityname: string; slug: string }> }
) {
  try {
    const { vanityname, slug } = await params;

    const creator = await db.user.findFirst({
      where: { vanityUrl: vanityname, deletedAt: null },
      select: { id: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const project = await db.project.findFirst({
      where: { slug, creatorId: creator.id, deletedAt: null },
      select: { id: true, goalAmount: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const stats = await getProjectStats(project.id, {
      status: project.status,
      goalAmount: project.goalAmount,
    });

    // Stats are public counters with no per-user data, polled aggressively
    // by the project page. A 30s cache lets the browser + any CDN
    // collapse the dozens of poll requests per minute into one origin
    // hit, which both reduces DB load and prevents real visitors from
    // tripping the 120 req/min general rate limiter (see src/proxy.ts).
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    projectsVanityStatsLogger.error({ err: String(error) }, "Get project stats error:");
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
