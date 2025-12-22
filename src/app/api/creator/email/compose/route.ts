import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST - Compose and send a new email
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { to, subject, content, projectId } = body;

    if (!to?.trim()) {
      return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
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

    // Can't send to yourself
    if (recipient.id === session.user.id) {
      return NextResponse.json(
        { error: "You cannot send an email to yourself" },
        { status: 400 }
      );
    }

    // If projectId provided, verify creator owns it
    if (projectId) {
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
    }

    // Create the message
    const message = await db.message.create({
      data: {
        senderId: session.user.id,
        recipientId: recipient.id,
        projectId: projectId || null,
        subject: subject?.trim() || null,
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
        content: message.content,
        recipient: message.recipient,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error composing email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
