import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST - Mark thread as read
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
    console.error("Error marking thread as read:", error);
    return NextResponse.json(
      { error: "Failed to mark as read" },
      { status: 500 }
    );
  }
}
