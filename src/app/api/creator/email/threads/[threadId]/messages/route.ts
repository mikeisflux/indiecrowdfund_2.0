import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Fetch messages for a thread
export async function GET(
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

    // Fetch all messages in this thread (both sent and received)
    const messages = await db.message.findMany({
      where: {
        projectId,
        OR: [
          // Messages from this sender to the creator
          { senderId, recipientId: session.user.id },
          // Replies from the creator to this sender
          { senderId: session.user.id, recipientId: senderId },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formattedMessages = messages.map((msg: (typeof messages)[number]) => ({
      id: msg.id,
      threadId: params.threadId,
      content: msg.content,
      sender: {
        id: msg.sender.id,
        name: msg.sender.name || "Unknown",
        email: msg.sender.email || "",
        image: msg.sender.image,
        isCreator: msg.sender.id === session.user.id,
      },
      createdAt: msg.createdAt.toISOString(),
    }));

    return NextResponse.json({ messages: formattedMessages });
  } catch (error) {
    console.error("Error fetching thread messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
