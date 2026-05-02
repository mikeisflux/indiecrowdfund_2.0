import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const projectsSimilarLogger = logger.child({ module: "projects-similar" });
import { db } from "@/lib/db";
import { getBatchProjectStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const category = searchParams.get("category");
    const limit = Math.min(parseInt(searchParams.get("limit") || "3"), 6);

    if (!projectId || !category) {
      return NextResponse.json({ projects: [] });
    }

    const projects = await db.project.findMany({
      where: {
        id: { not: projectId },
        category,
        status: { in: ["LIVE", "FUNDED"] },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        goalAmount: true,
        status: true,
        category: true,
        endDate: true,
        creator: {
          select: {
            vanityUrl: true,
            name: true,
          },
        },
      },
      orderBy: { backerCount: "desc" },
      take: limit,
    });

    const statsMap = await getBatchProjectStats(
      projects.map((p) => ({ id: p.id, status: p.status, goalAmount: p.goalAmount }))
    );

    const formattedProjects = projects.map((p) => {
      const goal = Number(p.goalAmount) || 1;
      const liveStats = statsMap.get(p.id) ?? { currentAmount: 0, backerCount: 0 };
      const fundedPercent = Math.round((liveStats.currentAmount / goal) * 100);
      const endDate = p.endDate ? p.endDate.toISOString() : null;
      const daysLeft = p.endDate
        ? Math.max(0, Math.ceil((p.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        imageUrl: p.imageUrl,
        currentAmount: liveStats.currentAmount,
        goalAmount: goal,
        backerCount: liveStats.backerCount,
        category: p.category,
        creator: p.creator?.name || "Creator",
        vanityUrl: p.creator?.vanityUrl || null,
        endDate,
        daysLeft,
        fundedPercent,
        isProjectWeLove: false,
      };
    });

    return NextResponse.json(
      { projects: formattedProjects },
      {
        headers: {
          // Browser + edge cache for 5 minutes; SWR for 10 more.
          // The similar-projects rail is purely cosmetic — slightly stale
          // results are fine, and caching cuts repeat hits from page
          // reloads / Instagram in-app browser preloads down to a single
          // origin request per 5min per IP, which keeps the endpoint off
          // the rate limiter's radar during traffic bursts.
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    projectsSimilarLogger.error({ err: String(error) }, "Similar projects error:");
    return NextResponse.json({ projects: [] });
  }
}
