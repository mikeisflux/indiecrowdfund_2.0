import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const projectsSimilarLogger = logger.child({ module: "projects-similar" });
import { db } from "@/lib/db";

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
        currentAmount: true,
        goalAmount: true,
        backerCount: true,
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

    const formattedProjects = projects.map((p) => {
      const goal = Number(p.goalAmount) || 1;
      const current = Number(p.currentAmount) || 0;
      const fundedPercent = Math.round((current / goal) * 100);
      const endDate = p.endDate ? p.endDate.toISOString() : null;
      const daysLeft = p.endDate
        ? Math.max(0, Math.ceil((p.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        imageUrl: p.imageUrl,
        currentAmount: current,
        goalAmount: goal,
        backerCount: p.backerCount,
        category: p.category,
        creator: p.creator?.name || "Creator",
        vanityUrl: p.creator?.vanityUrl || null,
        endDate,
        daysLeft,
        fundedPercent,
        isProjectWeLove: false,
      };
    });

    return NextResponse.json({ projects: formattedProjects });
  } catch (error) {
    projectsSimilarLogger.error({ err: String(error) }, "Similar projects error:");
    return NextResponse.json({ projects: [] });
  }
}
