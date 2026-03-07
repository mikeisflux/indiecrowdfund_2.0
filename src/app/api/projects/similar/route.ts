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

    const formattedProjects = projects.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      imageUrl: p.imageUrl,
      currentAmount: Number(p.currentAmount),
      goalAmount: Number(p.goalAmount),
      backerCount: p.backerCount,
      category: p.category,
      creatorName: p.creator?.name || "Creator",
      vanityUrl: p.creator?.vanityUrl || null,
    }));

    return NextResponse.json({ projects: formattedProjects });
  } catch (error) {
    projectsSimilarLogger.error({ err: String(error) }, "Similar projects error:");
    return NextResponse.json({ projects: [] });
  }
}
