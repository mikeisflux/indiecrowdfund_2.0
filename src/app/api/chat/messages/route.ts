import { NextRequest, NextResponse } from "next/server";
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // Get current user info including role and ban status
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        chatBannedAt: true,
        chatBanReason: true,
      },
    });

    const whereClause: {
      deletedAt: null;
      createdAt?: { gt?: Date; lt?: Date; gte?: Date };
    } = {
      deletedAt: null,
    };

    // Enforce 1-week history retention window for initial/scroll-back loads
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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
        whereClause.createdAt = { lt: beforeMessage.createdAt, gte: oneWeekAgo };
      }
    } else {
      // Initial load - only show messages from the last week
      whereClause.createdAt = { gte: oneWeekAgo };
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
          createdAt: {
            lt: oldestFetched.createdAt,
            gte: oneWeekAgo,
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
    console.error("Error fetching chat messages:", error);
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
    const user = await db.user.findUnique({
      where: { id: session.user.id },
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
    const { content, type = "TEXT", stickerData } = body;

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

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Error sending chat message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
