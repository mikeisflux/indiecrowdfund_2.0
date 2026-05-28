import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const normalizeLogger = logger.child({ module: "admin-normalize-nsfw-campaign-type" });

export const dynamic = "force-dynamic";

/**
 * Retroactively normalize NSFW projects that still have campaignType = ALL_OR_NOTHING.
 * NSFW projects must use KEEP_IT_ALL because Stripe/PayPal aren't available to them.
 * Super admin only.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find all NSFW projects with wrong campaign type
    const projectsToFix = await db.project.findMany({
      where: {
        deletedAt: null,
        campaignType: "ALL_OR_NOTHING",
        OR: [
          { hasAdultContent: true },
          { hasRiskyContent: true },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        paymentProcessor: true,
      },
    });

    if (projectsToFix.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No projects need normalization",
        fixed: 0,
      });
    }

    // Bulk update
    const result = await db.project.updateMany({
      where: {
        id: { in: projectsToFix.map((p) => p.id) },
      },
      data: {
        campaignType: "KEEP_IT_ALL",
      },
    });

    normalizeLogger.info(
      { count: result.count, projects: projectsToFix.map((p) => ({ id: p.id, title: p.title })) },
      "[Normalize NSFW] Updated NSFW projects to KEEP_IT_ALL"
    );

    return NextResponse.json({
      success: true,
      fixed: result.count,
      projects: projectsToFix.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
      })),
    });
  } catch (error) {
    normalizeLogger.error({ err: formatError(error) }, "Error normalizing NSFW campaign types");
    return NextResponse.json(
      { error: "Failed to normalize NSFW projects" },
      { status: 500 }
    );
  }
}
