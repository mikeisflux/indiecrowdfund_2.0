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

    const creator = await db.user.findUnique({
      where: { vanityUrl: vanityname },
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

    return NextResponse.json(stats);
  } catch (error) {
    projectsVanityStatsLogger.error({ err: String(error) }, "Get project stats error:");
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
