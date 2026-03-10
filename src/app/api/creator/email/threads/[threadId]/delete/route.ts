import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorEmailThreadsDeleteLogger = logger.child({ module: "creator-email-threads-delete" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// DELETE - Delete all messages in a thread
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Thread ID format: senderId::projectId (projectId may be "none" for null)
    const parts = threadId.split("::");
    const senderId = parts[0];
    const projectId = parts[1] === "none" ? null : parts[1] || null;

    if (!senderId) {
      return NextResponse.json({ error: "Invalid thread ID" }, { status: 400 });
    }

    // Delete all messages in this thread where user is recipient or sender
    const deleteResult = await db.message.deleteMany({
      where: {
        projectId,
        OR: [
          {
            senderId: senderId,
            recipientId: session.user.id,
          },
          {
            senderId: session.user.id,
            recipientId: senderId,
          },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.count,
    });
  } catch (error) {
    creatorEmailThreadsDeleteLogger.error({ err: String(error) }, "Error deleting thread:");
    return NextResponse.json(
      { error: "Failed to delete thread" },
      { status: 500 }
    );
  }
}
