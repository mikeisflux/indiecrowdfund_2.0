import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateCSRF } from "@/lib/csrf";

export const dynamic = "force-dynamic";

// POST - Send a reply to a thread
export async function POST(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    // Validate CSRF
    const csrfValid = await validateCSRF(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Thread ID format: senderId-projectId
    const [recipientId, projectId] = params.threadId.split("-");

    if (!recipientId || !projectId) {
      return NextResponse.json({ error: "Invalid thread ID" }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    // Verify the project exists and the user is the creator
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        creatorId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or you're not the creator" },
        { status: 404 }
      );
    }

    // Get the original thread to copy the subject
    const originalMessage = await db.message.findFirst({
      where: {
        projectId,
        senderId: recipientId,
        recipientId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
    });

    // Create the reply message
    const message = await db.message.create({
      data: {
        projectId,
        senderId: session.user.id,
        recipientId,
        subject: originalMessage?.subject ? `Re: ${originalMessage.subject}` : "Reply",
        content: content.trim(),
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
      },
    });

    return NextResponse.json({
      message: {
        id: message.id,
        threadId: params.threadId,
        content: message.content,
        sender: {
          id: message.sender.id,
          name: message.sender.name || "Unknown",
          email: message.sender.email || "",
          image: message.sender.image,
          isCreator: true,
        },
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error sending reply:", error);
    return NextResponse.json(
      { error: "Failed to send reply" },
      { status: 500 }
    );
  }
}
