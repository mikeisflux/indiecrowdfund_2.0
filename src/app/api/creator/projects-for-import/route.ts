import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

import { logger } from "@/lib/logger";

const creatorProjectsForImportLogger = logger.child({ module: "creator-projects-for-import" });


export const dynamic = "force-dynamic";

/**
 * GET /api/creator/projects-for-import
 *
 * Returns projects the user can import rewards from:
 * - Projects they created
 * - Projects they are an accepted collaborator on
 *
 * Excludes a specific project if ?exclude=projectId is provided
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      creatorProjectsForImportLogger.info("[projects-for-import] Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const excludeProjectId = searchParams.get("exclude");

    creatorProjectsForImportLogger.info({ userId: session.user.id, excludeProjectId }, "Fetching projects for import");

    // Find projects where user is creator OR an accepted collaborator
    const projects = await db.project.findMany({
      where: {
        OR: [
          // Projects user created
          { creatorId: session.user.id },
          // Projects user is an accepted collaborator on
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
        // Exclude the current project if specified
        ...(excludeProjectId && excludeProjectId !== "undefined" && excludeProjectId !== "null"
          ? { id: { not: excludeProjectId } }
          : {}),
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        status: true,
        creatorId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    creatorProjectsForImportLogger.info({ count: projects.length }, "Found projects for import");

    return NextResponse.json({ projects });
  } catch (error) {
    creatorProjectsForImportLogger.error({ err: error }, "[projects-for-import] Failed to fetch projects:");
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
