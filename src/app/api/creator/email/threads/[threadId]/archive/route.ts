import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST - Archive a thread (mark messages as spam/archived)
export async function POST(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Thread ID format: senderId-projectId
    const [senderId, projectId] = params.threadId.split("-");

    if (!senderId || !projectId) {
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
    console.error("Error archiving thread:", error);
    return NextResponse.json(
      { error: "Failed to archive thread" },
      { status: 500 }
    );
  }
}
