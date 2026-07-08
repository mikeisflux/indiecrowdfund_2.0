import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const collaborationsLogger = logger.child({ module: "collaborations" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// DELETE - Remove yourself as a collaborator from a project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find the collaboration - must belong to the current user
    const collaboration = await db.projectCollaborator.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        project: {
          select: { title: true, creatorId: true },
        },
      },
    });

    if (!collaboration) {
      return NextResponse.json(
        { error: "Collaboration not found" },
        { status: 404 }
      );
    }

    // Delete the collaboration record. Use deleteMany so a concurrent
    // second DELETE request doesn't throw P2025 (record not found) —
    // and only fire the "collaborator left" notification for the
    // request that actually deleted the row.
    const deletedCount = await db.projectCollaborator.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (deletedCount.count > 0) {
      // Notify the project creator — only on the winning delete
      try {
        await db.notification.create({
          data: {
            userId: collaboration.project.creatorId,
            type: "COLLABORATOR_DECLINED",
            title: "Collaborator left",
            message: `${session.user.name || session.user.email} removed themselves as a collaborator from "${collaboration.project.title}"`,
            actionUrl: `/dashboard`,
            senderId: session.user.id,
          },
        });
      } catch (notifError) {
        collaborationsLogger.error({ err: String(notifError) }, "Failed to create notification:");
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    collaborationsLogger.error({ err: formatError(error) }, "Error removing collaboration:");
    return NextResponse.json(
      { error: "Failed to remove collaboration" },
      { status: 500 }
    );
  }
}
