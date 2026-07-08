import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorEmailThreadsArchiveLogger = logger.child({ module: "creator-email-threads-archive" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST - Archive a thread (mark messages as spam/archived)
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

    // Archive all messages in this thread where user is recipient
    await db.message.updateMany({
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
      data: {
        isSpam: true, // Using isSpam as archived flag
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorEmailThreadsArchiveLogger.error({ err: formatError(error) }, "Error archiving thread:");
    return NextResponse.json(
      { error: "Failed to archive thread" },
      { status: 500 }
    );
  }
}
