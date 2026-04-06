import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const messagesLogger = logger.child({ module: "messages" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const createMessageSchema = z.object({
  projectId: z.string(),
  recipientId: z.string(),
  subject: z.string().optional(),
  content: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createMessageSchema.parse(body);

    // Verify project exists
    const project = await db.project.findUnique({
      where: { id: data.projectId },
      select: { id: true, creatorId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify recipient exists and get their details
    const recipient = await db.user.findUnique({
      where: { id: data.recipientId },
      select: { id: true, email: true, name: true },
    });

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    // Get sender's name for the notification
    const sender = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });

    // Get project title for context
    const projectForEmail = await db.project.findUnique({
      where: { id: data.projectId },
      select: { title: true, slug: true },
    });

    const message = await db.message.create({
      data: {
        projectId: data.projectId,
        senderId: session.user.id,
        recipientId: data.recipientId,
        subject: data.subject,
        content: data.content,
      },
      include: {
        sender: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    // Send email notification to recipient
    if (recipient.email) {
      try {
        const senderName = sender?.name || "Someone";
        const projectTitle = projectForEmail?.title || "a project";
        const contentPreview = data.content.length > 200
          ? data.content.substring(0, 200) + "..."
          : data.content;

        await sendEmail({
          to: recipient.email,
          subject: `New message from ${senderName} about "${projectTitle}"`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #6366f1;">You have a new message</h2>
              <p>Hi ${escapeHtml(recipient.name || "there")},</p>
              <p><strong>${escapeHtml(senderName)}</strong> sent you a message about <strong>${escapeHtml(projectTitle)}</strong>:</p>
              <div style="background: #f3f4f6; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                ${data.subject ? `<p style="margin: 0 0 8px 0; font-weight: bold;">${escapeHtml(data.subject)}</p>` : ""}
                <p style="margin: 0; color: #374151; white-space: pre-wrap;">${escapeHtml(contentPreview)}</p>
              </div>
              <p style="margin-top: 20px;">
                <a href="${APP_URL}/dashboard/messages?projectId=${data.projectId}&recipientId=${session.user.id}" style="background: linear-gradient(to right, #6366f1, #a855f7); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">View & Reply</a>
              </p>
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                You received this email because someone sent you a message on ${APP_NAME}.
                <a href="${APP_URL}/dashboard/backer?tab=notifications" style="color: #6366f1;">Manage your notification preferences</a>
              </p>
            </div>
          `,
          skipUnsubscribeCheck: true, // Transactional email for direct messages
        });
      } catch (emailError) {
        messagesLogger.error({ err: String(emailError) }, "Failed to send message notification email:");
        // Don't fail the message creation if email fails
      }
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    messagesLogger.error({ err: String(error) }, "Create message error:");
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const view = searchParams.get("view") || "inbox";
    const conversationWith = searchParams.get("conversationWith");

    const userId = session.user.id;

    // Build where clause
    const whereClause: {
      senderId?: string;
      recipientId?: string;
      OR?: Array<{ senderId: string; recipientId: string }>;
      projectId?: string;
      isSpam: boolean;
    } = { isSpam: false };

    if (conversationWith) {
      // Get conversation thread with specific user
      whereClause.OR = [
        { senderId: userId, recipientId: conversationWith },
        { senderId: conversationWith, recipientId: userId },
      ];
      if (projectId) {
        whereClause.projectId = projectId;
      }
    } else if (view === "sent") {
      whereClause.senderId = userId;
      if (projectId) whereClause.projectId = projectId;
    } else {
      whereClause.recipientId = userId;
      if (projectId) whereClause.projectId = projectId;
    }

    const messages = await db.message.findMany({
      where: whereClause,
      include: {
        sender: {
          select: { id: true, name: true, image: true },
        },
        recipient: {
          select: { id: true, name: true, image: true },
        },
        project: {
          select: { id: true, title: true, slug: true, imageUrl: true },
        },
      },
      orderBy: { createdAt: conversationWith ? "asc" : "desc" },
    });

    // Build conversations list (unique by otherUser + project)
    const conversationsMap = new Map<string, {
      id: string;
      otherUser: { id: string; name: string | null; image: string | null };
      project: { id: string; title: string; slug: string; imageUrl: string | null } | null;
      lastMessage: {
        id: string;
        content: string;
        createdAt: Date;
        senderId: string;
      };
      unreadCount: number;
    }>();

    // Get all messages for conversations (both sent and received)
    const allMessages = await db.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { recipientId: userId },
        ],
        isSpam: false,
      },
      include: {
        sender: { select: { id: true, name: true, image: true } },
        recipient: { select: { id: true, name: true, image: true } },
        project: { select: { id: true, title: true, slug: true, imageUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    for (const msg of allMessages) {
      const otherUser = msg.senderId === userId ? msg.recipient : msg.sender;
      // Use "inbox" for messages without a project (creator inbox emails)
      const key = `${otherUser.id}-${msg.projectId || "inbox"}`;

      if (!conversationsMap.has(key)) {
        conversationsMap.set(key, {
          id: key,
          otherUser,
          project: msg.project,
          lastMessage: {
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt,
            senderId: msg.senderId,
          },
          unreadCount: 0,
        });
      }
    }

    // Count unread messages for each conversation
    for (const [, conv] of Array.from(conversationsMap)) {
      const unreadCount = await db.message.count({
        where: {
          senderId: conv.otherUser.id,
          recipientId: userId,
          // Handle messages without a project (creator inbox emails)
          projectId: conv.project?.id || null,
          read: false,
          isSpam: false,
        },
      });
      conv.unreadCount = unreadCount;
    }

    const conversations = Array.from(conversationsMap.values());

    // Get total unread count
    const totalUnread = await db.message.count({
      where: {
        recipientId: userId,
        read: false,
        isSpam: false,
      },
    });

    return NextResponse.json({ messages, conversations, totalUnread });
  } catch (error) {
    messagesLogger.error({ err: String(error) }, "Get messages error:");
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// Mark messages as read
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messageIds, conversationWith, projectId } = body;

    const userId = session.user.id;

    if (messageIds && Array.isArray(messageIds)) {
      // Mark specific messages as read
      await db.message.updateMany({
        where: {
          id: { in: messageIds },
          recipientId: userId,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });
    } else if (conversationWith && projectId) {
      // Mark all messages in conversation as read
      await db.message.updateMany({
        where: {
          senderId: conversationWith,
          recipientId: userId,
          projectId,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    messagesLogger.error({ err: String(error) }, "Mark messages read error:");
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}
