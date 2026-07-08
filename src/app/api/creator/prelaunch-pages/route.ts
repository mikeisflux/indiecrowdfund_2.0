import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorPrelaunchPagesLogger = logger.child({ module: "creator-prelaunch-pages" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/creator/prelaunch-pages
 *
 * Get all prelaunch pages for the current user
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get all projects that have prelaunch content or are in prelaunch status
    // This includes projects that haven't launched yet but have prelaunch data.
    // Prisma 7 rejects `{ field: { not: null } }` on nullable string fields
    // at runtime — use `NOT: { field: null }` wrapper syntax instead.
    const projects = await db.project.findMany({
      where: {
        creatorId: userId,
        deletedAt: null,
        OR: [
          { prelaunchActive: true },
          { prelaunchStatus: { not: "DRAFT" } },
          { NOT: { prelaunchDescription: null } },
          // Also include projects that are in DRAFT status (not yet launched)
          { status: "DRAFT" },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        prelaunchStatus: true,
        prelaunchActive: true,
        prelaunchDescription: true,
        createdAt: true,
        creator: {
          select: {
            vanityUrl: true,
          },
        },
        _count: {
          select: {
            followers: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format the response
    const pages = projects.map((project) => ({
      id: project.id,
      title: project.title,
      slug: project.slug,
      status: project.prelaunchStatus,
      prelaunchActive: project.prelaunchActive,
      prelaunchDescription: project.prelaunchDescription,
      followerCount: project._count.followers,
      createdAt: project.createdAt.toISOString(),
      vanityUrl: project.creator?.vanityUrl || null,
    }));

    return NextResponse.json({ pages });
  } catch (error) {
    creatorPrelaunchPagesLogger.error({ err: formatError(error) }, "Error fetching prelaunch pages:");
    return NextResponse.json(
      { error: "Failed to fetch prelaunch pages" },
      { status: 500 }
    );
  }
}
