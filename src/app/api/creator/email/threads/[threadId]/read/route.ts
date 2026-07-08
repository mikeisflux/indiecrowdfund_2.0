import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorEmailThreadsReadLogger = logger.child({ module: "creator-email-threads-read" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST - Mark thread as read
export async function POST(
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

    // Mark all messages in this thread as read
    await db.message.updateMany({
      where: {
        projectId,
        senderId,
        recipientId: session.user.id,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorEmailThreadsReadLogger.error({ err: formatError(error) }, "Error marking thread as read:");
    return NextResponse.json(
      { error: "Failed to mark as read" },
      { status: 500 }
    );
  }
}
