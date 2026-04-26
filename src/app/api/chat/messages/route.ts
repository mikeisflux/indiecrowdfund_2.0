import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const chatMessagesLogger = logger.child({ module: "chat-messages" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET - Fetch chat messages (with polling support)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const after = searchParams.get("after"); // For polling - get messages after this ID
    const before = searchParams.get("before"); // For scroll-back - get messages before this ID
    const roomId = searchParams.get("roomId"); // Per-creator room scoping; null = legacy global
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // Get current user info including role and ban status
    const currentUser = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: {
        role: true,
        chatBannedAt: true,
        chatBanReason: true,
      },
    });

    const whereClause: {
      deletedAt: null;
      roomId?: string | null;
      createdAt?: { gt?: Date; lt?: Date; gte?: Date };
    } = {
      deletedAt: null,
      roomId: roomId || null,
    };

    // Enforce 6-month (180-day) history retention window for initial/scroll-back loads
    const retentionCutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    // If polling for new messages
    if (after) {
      const afterMessage = await db.chatMessage.findUnique({
        where: { id: after },
        select: { createdAt: true },
      });

      if (afterMessage) {
        whereClause.createdAt = { gt: afterMessage.createdAt };
      }
    } else if (before) {
      // Scroll-back: load older messages before a given message
      const beforeMessage = await db.chatMessage.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });

      if (beforeMessage) {
        whereClause.createdAt = { lt: beforeMessage.createdAt, gte: retentionCutoff };
      }
    } else {
      // Initial load - only show messages from the last week
      whereClause.createdAt = { gte: retentionCutoff };
    }

    const messages = await db.chatMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            vanityUrl: true,
          },
        },
      },
    });

    // Determine if current user can moderate
    const canModerate =
      currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";

    // Check if there are older messages available (for scroll-back)
    const oldestFetched = messages[messages.length - 1];
    let hasMore = false;
    if (oldestFetched && !after) {
      const olderCount = await db.chatMessage.count({
        where: {
          deletedAt: null,
          roomId: roomId || null,
          createdAt: {
            lt: oldestFetched.createdAt,
            gte: retentionCutoff,
          },
        },
      });
      hasMore = olderCount > 0;
    }

    // Return in chronological order (oldest first)
    return NextResponse.json({
      messages: messages.reverse(),
      hasMore,
      canModerate,
      isBanned: !!currentUser?.chatBannedAt,
      banReason: currentUser?.chatBanReason,
    });
  } catch (error) {
    chatMessagesLogger.error({ err: String(error) }, "Error fetching chat messages:");
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST - Send a new chat message
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is banned from chat
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { chatBannedAt: true, chatBanReason: true },
    });

    if (user?.chatBannedAt) {
      return NextResponse.json(
        {
          error: "You have been banned from chat",
          reason: user.chatBanReason || "Violated community guidelines",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { content, type = "TEXT", stickerData, roomId } = body;

    // Validate message content
    if (type === "TEXT" || type === "EMOJI") {
      if (!content || typeof content !== "string") {
        return NextResponse.json(
          { error: "Message content is required" },
          { status: 400 }
        );
      }

      // Limit message length
      if (content.length > 2000) {
        return NextResponse.json(
          { error: "Message too long (max 2000 characters)" },
          { status: 400 }
        );
      }

      // Check for empty messages (whitespace only)
      if (content.trim().length === 0) {
        return NextResponse.json(
          { error: "Message cannot be empty" },
          { status: 400 }
        );
      }
    }

    if (type === "STICKER") {
      if (!stickerData || !stickerData.stickerId) {
        return NextResponse.json(
          { error: "Sticker data is required" },
          { status: 400 }
        );
      }
    }

    if (type === "GIF") {
      if (!stickerData || typeof stickerData.url !== "string" || !/^https?:\/\//.test(stickerData.url)) {
        return NextResponse.json(
          { error: "GIF url is required" },
          { status: 400 }
        );
      }
    }

    // Rate limiting - check if user sent message in last 500ms
    const recentMessage = await db.chatMessage.findFirst({
      where: {
        userId: session.user.id,
        createdAt: { gt: new Date(Date.now() - 500) },
      },
    });

    if (recentMessage) {
      return NextResponse.json(
        { error: "Please wait before sending another message" },
        { status: 429 }
      );
    }

    // Create the message
    const message = await db.chatMessage.create({
      data: {
        content: content?.trim() || "",
        type,
        stickerData: stickerData || undefined,
        userId: session.user.id,
        roomId: roomId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            vanityUrl: true,
          },
        },
      },
    });

    // Auto-join the sender into the room they posted in. Membership is
    // sticky — they'll keep showing up in the active-users sidebar
    // (online or offline) until they explicitly click leave.
    if (roomId) {
      await db.chatRoomMember
        .upsert({
          where: { roomId_userId: { roomId, userId: session.user.id } },
          update: { lastReadAt: new Date() },
          create: { roomId, userId: session.user.id },
        })
        .catch((err: unknown) => {
          chatMessagesLogger.warn({ err: String(err) }, "auto-join failed");
        });

      // Best-effort: notify the room's other members. Wrapped in
      // try/catch so a notification miss never blocks message send.
      try {
        const senderName = message.user.name || "Someone";
        const otherMembers = await db.chatRoomMember.findMany({
          where: {
            roomId,
            userId: { not: session.user.id },
            notificationsEnabled: true,
          },
          select: { userId: true },
        });
        if (otherMembers.length > 0) {
          const room = await db.chatRoom.findUnique({
            where: { id: roomId },
            select: { name: true, slug: true },
          });
          const preview =
            type === "TEXT" || type === "EMOJI"
              ? (content as string).slice(0, 140)
              : type === "GIF"
                ? "sent a GIF"
                : "sent a sticker";
          await db.notification.createMany({
            data: otherMembers.map((m: { userId: string }) => ({
              userId: m.userId,
              type: "CHAT_MESSAGE" as const,
              title: `New message in ${room?.name || "chat"}`,
              message: `${senderName}: ${preview}`,
              actionUrl: `/chat/${room?.slug || roomId}`,
            })),
          });
        }
      } catch (notifyErr) {
        chatMessagesLogger.warn(
          { err: String(notifyErr) },
          "Chat message notification dispatch failed"
        );
      }
    }

    return NextResponse.json({ message });
  } catch (error) {
    chatMessagesLogger.error({ err: String(error) }, "Error sending chat message:");
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
