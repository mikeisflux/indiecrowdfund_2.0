import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const excludeProjectId = searchParams.get("exclude");

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
        ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
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

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to fetch projects for import:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
