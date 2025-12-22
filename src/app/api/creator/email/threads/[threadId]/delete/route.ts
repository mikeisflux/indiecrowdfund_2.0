import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// DELETE - Delete all messages in a thread
export async function DELETE(
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
    console.error("Error deleting thread:", error);
    return NextResponse.json(
      { error: "Failed to delete thread" },
      { status: 500 }
    );
  }
}
