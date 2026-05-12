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

    // Stats must reflect new pledges in real time — backers expect the
    // page total to bump the moment their pledge clears. The old 30s
    // CDN/browser cache was visibly lagging behind the creator
    // dashboard (creator saw $1,494.77 / 18 backers; public was stuck
    // at $1,285 / 17 for up to 30s because Cloudflare was serving the
    // cached response). Polling is once per 15s per tab, well under
    // the 120 req/min per-IP limiter, so an origin hit per poll is
    // safe — the prior cache was over-engineered for a public stats
    // endpoint.
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    projectsVanityStatsLogger.error({ err: String(error) }, "Get project stats error:");
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
