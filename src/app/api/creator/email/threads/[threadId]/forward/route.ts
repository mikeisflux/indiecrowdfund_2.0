import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST - Forward a thread to another user
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
    const [originalSenderId, projectId] = params.threadId.split("-");

    if (!originalSenderId || !projectId) {
      return NextResponse.json({ error: "Invalid thread ID" }, { status: 400 });
    }

    const body = await request.json();
    const { to, additionalMessage } = body;

    if (!to?.trim()) {
      return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
    }

    // Find recipient by email
    const recipient = await db.user.findUnique({
      where: { email: to.trim().toLowerCase() },
      select: { id: true, name: true, email: true },
    });

    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient not found. They must have an account on the platform." },
        { status: 404 }
      );
    }

    // Can't forward to yourself
    if (recipient.id === session.user.id) {
      return NextResponse.json(
        { error: "You cannot forward an email to yourself" },
        { status: 400 }
      );
    }

    // Get the original thread messages
    const originalMessages = await db.message.findMany({
      where: {
        projectId,
        OR: [
          {
            senderId: originalSenderId,
            recipientId: session.user.id,
          },
          {
            senderId: session.user.id,
            recipientId: originalSenderId,
          },
        ],
      },
      include: {
        sender: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (originalMessages.length === 0) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Build forwarded content
    const originalSubject = originalMessages[0]?.subject || "No Subject";
    const forwardedContent = originalMessages
      .map((msg: typeof originalMessages[number]) => {
        const senderName = msg.sender.name || msg.sender.email;
        const date = msg.createdAt.toLocaleString();
        return `--- Forwarded from ${senderName} on ${date} ---\n${msg.content}`;
      })
      .join("\n\n");

    const fullContent = additionalMessage
      ? `${additionalMessage}\n\n${forwardedContent}`
      : forwardedContent;

    // Create the forwarded message
    const message = await db.message.create({
      data: {
        senderId: session.user.id,
        recipientId: recipient.id,
        projectId,
        subject: `Fwd: ${originalSubject}`,
        content: fullContent,
        read: false,
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
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        subject: message.subject,
        recipient: message.recipient,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error forwarding email:", error);
    return NextResponse.json(
      { error: "Failed to forward email" },
      { status: 500 }
    );
  }
}
