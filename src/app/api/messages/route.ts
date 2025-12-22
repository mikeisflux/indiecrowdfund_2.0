import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

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

    // Verify recipient exists
    const recipient = await db.user.findUnique({
      where: { id: data.recipientId },
      select: { id: true },
    });

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

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

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Create message error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
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
    console.error("Get messages error:", error);
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
    console.error("Mark messages read error:", error);
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}
