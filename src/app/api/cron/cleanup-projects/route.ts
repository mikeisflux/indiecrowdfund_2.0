import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const cronCleanupProjectsLogger = logger.child({ module: "cron-cleanup-projects" });
import { db } from "@/lib/db";

// Cron job to clean up unused draft projects after 90 days
// This endpoint should be called by a cron scheduler (e.g., Vercel Cron, external cron service)
// To prevent unauthorized access, a CRON_SECRET should be configured

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Calculate 90 days ago
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Find all draft projects that:
    // - Are in DRAFT status
    // - Have no backers
    // - Haven't been updated in 90+ days
    // - Are not already soft-deleted
    const projectsToCleanup = await db.project.findMany({
      where: {
        status: "DRAFT",
        backerCount: 0,
        updatedAt: { lt: ninetyDaysAgo },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        creatorId: true,
        updatedAt: true,
      },
    });

    if (projectsToCleanup.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No projects to clean up",
        cleanedCount: 0,
      });
    }

    // Soft delete the projects
    const result = await db.project.updateMany({
      where: {
        id: { in: projectsToCleanup.map(p => p.id) },
      },
      data: {
        deletedAt: new Date(),
      },
    });

    // Log the cleanup for audit purposes
    cronCleanupProjectsLogger.info({ data: {
      projectIds: projectsToCleanup.map(p => p.id),
      projectSlugs: projectsToCleanup.map(p => p.slug),
    } }, `[Cron] Project Sanitizer: Cleaned up ${result.count} unused draft projects`);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.count} unused draft projects`,
      cleanedCount: result.count,
      cleanedProjects: projectsToCleanup.map(p => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        lastUpdated: p.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    cronCleanupProjectsLogger.error({ err: String(error) }, "[Cron] Project Sanitizer Error:");
    return NextResponse.json(
      { error: "Failed to clean up projects" },
      { status: 500 }
    );
  }
}

// POST endpoint for manual triggering from admin panel
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  try {
    // For POST requests, verify admin authentication
    const { auth } = await import("@/lib/auth");
    const session = await auth();

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Same logic as GET
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const projectsToCleanup = await db.project.findMany({
      where: {
        status: "DRAFT",
        backerCount: 0,
        updatedAt: { lt: ninetyDaysAgo },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        creatorId: true,
        updatedAt: true,
      },
    });

    if (projectsToCleanup.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No projects to clean up",
        cleanedCount: 0,
      });
    }

    const result = await db.project.updateMany({
      where: {
        id: { in: projectsToCleanup.map(p => p.id) },
      },
      data: {
        deletedAt: new Date(),
      },
    });

    cronCleanupProjectsLogger.info({ data: {
      projectIds: projectsToCleanup.map(p => p.id),
    } }, `[Admin] Project Sanitizer: Manually cleaned up ${result.count} unused draft projects by ${session.user.email}`);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.count} unused draft projects`,
      cleanedCount: result.count,
      cleanedProjects: projectsToCleanup.map(p => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        lastUpdated: p.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    cronCleanupProjectsLogger.error({ err: String(error) }, "[Admin] Project Sanitizer Error:");
    return NextResponse.json(
      { error: "Failed to clean up projects" },
      { status: 500 }
    );
  }
}
