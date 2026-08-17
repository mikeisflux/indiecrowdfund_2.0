import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";

const liveCampaignsLogger = logger.child({ module: "ai-marketing-live-campaigns" });

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ai-marketing/live-campaigns
 *
 * The campaigns an operator can drop into a hand-written email, newest first.
 * LIVE only — a marketing email pointing at a draft or a finished campaign
 * sends readers to a page they cannot back.
 */
export async function GET() {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN" && session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await db.project.findMany({
      where: { status: "LIVE", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        shortDescription: true,
        imageUrl: true,
        creator: { select: { vanityUrl: true } },
      },
    });

    return NextResponse.json({
      campaigns: projects.map((p) => ({
        slug: p.slug,
        title: p.title,
        category: p.category,
        imageUrl: p.imageUrl,
        blurb: p.shortDescription || "",
        url: p.creator?.vanityUrl
          ? `/projects/${p.creator.vanityUrl}/${p.slug}`
          : `/projects/${p.slug}`,
      })),
    });
  } catch (error) {
    liveCampaignsLogger.error({ err: formatError(error) }, "Failed to list live campaigns");
    return NextResponse.json({ error: "Failed to list campaigns" }, { status: 500 });
  }
}
