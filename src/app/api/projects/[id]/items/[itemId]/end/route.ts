import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const projectsEndLogger = logger.child({ module: "projects-end" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST - End an item (make it unavailable for new pledges)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, itemId } = await params;

    // Verify project exists and user has access (creator or collaborator)
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
      select: { id: true, status: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or you don't have access" },
        { status: 404 }
      );
    }

    // Verify the item exists and belongs to this project
    const item = await db.projectItem.findFirst({
      where: {
        id: itemId,
        projectId,
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Check if item is already ended
    if (item.endedAt) {
      return NextResponse.json(
        { error: "Item has already been ended" },
        { status: 400 }
      );
    }

    // End the item
    const updatedItem = await db.projectItem.update({
      where: { id: itemId },
      data: { endedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      item: {
        id: updatedItem.id,
        title: updatedItem.title,
        endedAt: updatedItem.endedAt,
      },
    });
  } catch (error) {
    projectsEndLogger.error({ err: String(error) }, "Error ending item:");
    return NextResponse.json(
      { error: "Failed to end item" },
      { status: 500 }
    );
  }
}
