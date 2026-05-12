import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { getProjectStats, syncProjectStats } from "@/lib/stats";

const projectsSlugStatsLogger = logger.child({ module: "projects-slug-stats" });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const project = await db.project.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, goalAmount: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const stats = await getProjectStats(project.id, {
      status: project.status,
      goalAmount: project.goalAmount,
    });

    // Keep stored fields in sync
    await syncProjectStats(project.id).catch((err) =>
      projectsSlugStatsLogger.warn({ err: String(err) }, "Non-fatal: failed to sync project stats")
    );

    return NextResponse.json(stats, {
      headers: {
        // Real-time — see vanity stats route for the rationale. The
        // prior 30s cache made the public page visibly lag behind the
        // creator dashboard. Polling at 15s per tab is fine without a
        // cache layer.
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    projectsSlugStatsLogger.error({ err: String(error) }, "Failed to fetch project stats:");
    return NextResponse.json({ error: "Failed to fetch project stats" }, { status: 500 });
  }
}
