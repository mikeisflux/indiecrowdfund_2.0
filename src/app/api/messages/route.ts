import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const messagesLogger = logger.child({ module: "messages" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import {
  getDelegatedProjectCreators,
  getDelegatedProjectIds,
} from "@/lib/messages/delegated-projects";

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
  projectId: z.string().optional(),
  recipientId: z.string(),
  subject: z.string().max(500).optional(),
  content: z.string().min(1).max(50000),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createMessageSchema.parse(body);

    // Verify project exists (only when one was provided — project-less DMs
    // are allowed for direct messages started from a user profile)
    let projectForEmail: { title: string; slug: string } | null = null;
    if (data.projectId) {
      const project = await db.project.findFirst({
        where: { id: data.projectId, deletedAt: null },
        select: { id: true, creatorId: true },
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      projectForEmail = await db.project.findFirst({
        where: { id: data.projectId, deletedAt: null },
        select: { title: true, slug: true },
      });
    }

    // Verify recipient exists and is not deleted
    const recipient = await db.user.findFirst({
      where: { id: data.recipientId, deletedAt: null },
      select: { id: true, email: true, name: true },
    });

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    // Get sender's name for the notification (also guard deletedAt)
    const sender = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { name: true },
    });

    const message = await db.message.create({
      data: {
        projectId: data.projectId ?? null,
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
        const projectTitle = projectForEmail?.title || null;
        const contentPreview = data.content.length > 200
          ? data.content.substring(0, 200) + "..."
          : data.content;

        const replyParams = new URLSearchParams({ recipientId: session.user.id });
        if (data.projectId) replyParams.set("projectId", data.projectId);

        await sendEmail({
          to: recipient.email,
          subject: projectTitle
            ? `New message from ${senderName} about "${projectTitle}"`
            : `New message from ${senderName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #6366f1;">You have a new message</h2>
              <p>Hi ${escapeHtml(recipient.name || "there")},</p>
              <p><strong>${escapeHtml(senderName)}</strong> sent you ${projectTitle ? `a message about <strong>${escapeHtml(projectTitle)}</strong>` : "a direct message"}:</p>
              <div style="background: #f3f4f6; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                ${data.subject ? `<p style="margin: 0 0 8px 0; font-weight: bold;">${escapeHtml(data.subject)}</p>` : ""}
                <p style="margin: 0; color: #374151; white-space: pre-wrap;">${escapeHtml(contentPreview)}</p>
              </div>
              <p style="margin-top: 20px;">
                <a href="${APP_URL}/dashboard/messages?${replyParams.toString()}" style="background: linear-gradient(to right, #6366f1, #a855f7); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">View & Reply</a>
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
    messagesLogger.error({ err: formatError(error) }, "Create message error:");
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

    // Campaigns whose inbox this user shares with the owner. Every query below
    // is "mine, or belonging to one of these projects".
    const delegatedIds = await getDelegatedProjectIds(userId);
    const delegated = delegatedIds.length > 0;

    // Build where clause
    const whereClause: {
      senderId?: string;
      recipientId?: string;
      OR?: Array<Record<string, unknown>>;
      projectId?: string;
      isSpam: boolean;
    } = { isSpam: false };

    if (conversationWith) {
      // Get conversation thread with specific user. On a shared campaign the
      // thread is between the owner and the backer, so matching only on "me"
      // would return an empty thread — the delegate is in neither end of it.
      whereClause.OR = [
        { senderId: userId, recipientId: conversationWith },
        { senderId: conversationWith, recipientId: userId },
        ...(delegated
          ? [
              { projectId: { in: delegatedIds }, senderId: conversationWith },
              { projectId: { in: delegatedIds }, recipientId: conversationWith },
            ]
          : []),
      ];
      if (projectId) {
        whereClause.projectId = projectId;
      }
    } else if (view === "sent") {
      whereClause.senderId = userId;
      if (projectId) whereClause.projectId = projectId;
    } else {
      if (delegated) {
        whereClause.OR = [
          { recipientId: userId },
          { projectId: { in: delegatedIds } },
        ];
      } else {
        whereClause.recipientId = userId;
      }
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
          ...(delegated ? [{ projectId: { in: delegatedIds } }] : []),
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

    const delegatedCreators = await getDelegatedProjectCreators(delegatedIds);

    for (const msg of allMessages) {
      // On a shared campaign the counterpart is whoever isn't the campaign
      // owner — otherwise a message the owner sent files itself under the
      // owner's name and the backer's thread splits in two.
      const ownerId = msg.projectId ? delegatedCreators.get(msg.projectId) : undefined;
      const otherUser =
        ownerId && msg.senderId !== userId && msg.recipientId !== userId
          ? msg.senderId === ownerId
            ? msg.recipient
            : msg.sender
          : msg.senderId === userId
            ? msg.recipient
            : msg.sender;
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
      const isDelegated = !!conv.project && delegatedIds.includes(conv.project.id);
      const unreadCount = await db.message.count({
        where: {
          senderId: conv.otherUser.id,
          // On a shared campaign the unread message is addressed to the owner,
          // not to the delegate — pinning recipientId would always count zero.
          // Filtering on the backer as sender already makes this inbound-only.
          ...(isDelegated ? {} : { recipientId: userId }),
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
        OR: [
          { recipientId: userId },
          ...(delegated ? [{ projectId: { in: delegatedIds } }] : []),
        ],
        // Own outbound mail is unread until the backer opens it; that is the
        // backer's unread, not the sender's.
        NOT: { senderId: userId },
        read: false,
        isSpam: false,
      },
    });

    return NextResponse.json({ messages, conversations, totalUnread });
  } catch (error) {
    messagesLogger.error({ err: formatError(error) }, "Get messages error:");
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

    // Reading a shared campaign's message marks it read for the owner too.
    // That is the point of a shared inbox: if it stayed unread for them, both
    // people keep working the same message and the backer gets two replies.
    const delegatedIds = await getDelegatedProjectIds(userId);
    const mine = delegatedIds.length > 0
      ? [{ recipientId: userId }, { projectId: { in: delegatedIds } }]
      : [{ recipientId: userId }];

    if (messageIds && Array.isArray(messageIds)) {
      // Mark specific messages as read
      await db.message.updateMany({
        where: {
          id: { in: messageIds },
          OR: mine,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });
    } else if (conversationWith) {
      // Mark all messages in this conversation as read. projectId is
      // optional — when omitted (e.g. project-less DMs from a profile),
      // we mark every message between the two users as read.
      await db.message.updateMany({
        where: {
          senderId: conversationWith,
          OR: mine,
          ...(projectId ? { projectId } : {}),
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    messagesLogger.error({ err: formatError(error) }, "Mark messages read error:");
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}
