import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const chatPresenceLogger = logger.child({ module: "chat-presence" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const INACTIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const REMOVE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

// GET - Fetch active users in a chat room. Supply ?roomId=... for a
// per-creator room; omit it for the legacy global feed.
//
// Returns ALL persistent members of the room (so the sidebar can show
// offline users too), each tagged with status active / inactive /
// offline based on the matching ChatPresence row.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");

    const now = new Date();
    const removeThreshold = new Date(now.getTime() - REMOVE_THRESHOLD_MS);

    // Clean up presence rows older than 30 minutes (in this room)
    await db.chatPresence.deleteMany({
      where: {
        roomId: roomId || null,
        lastActiveAt: { lt: removeThreshold },
      },
    });

    if (roomId) {
      // Persistent members + their presence row (if any) → online status.
      const members = await db.chatRoomMember.findMany({
        where: { roomId },
        include: {
          user: {
            select: { id: true, name: true, image: true, vanityUrl: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      });

      const presences = await db.chatPresence.findMany({
        where: { roomId },
        select: { userId: true, lastActiveAt: true },
      });
      const presenceByUser = new Map(
        presences.map((p) => [p.userId, p.lastActiveAt])
      );
      const inactiveThreshold = new Date(now.getTime() - INACTIVE_THRESHOLD_MS);

      const users = members.map((m) => {
        const lastActive = presenceByUser.get(m.userId);
        let status: "active" | "inactive" | "offline" = "offline";
        if (lastActive) {
          status = lastActive >= inactiveThreshold ? "active" : "inactive";
        }
        return {
          ...m.user,
          status,
          lastActiveAt: lastActive?.toISOString() ?? null,
        };
      });

      return NextResponse.json({ users });
    }

    // Legacy global feed: presence-based active users only (kept for /chat).
    const presenceRecords = await db.chatPresence.findMany({
      where: { roomId: null },
      include: {
        user: {
          select: { id: true, name: true, image: true, vanityUrl: true },
        },
      },
      orderBy: { lastActiveAt: "desc" },
    });
    const inactiveThreshold = new Date(now.getTime() - INACTIVE_THRESHOLD_MS);
    const users = presenceRecords.map((record) => ({
      ...record.user,
      status:
        record.lastActiveAt >= inactiveThreshold
          ? ("active" as const)
          : ("inactive" as const),
      lastActiveAt: record.lastActiveAt.toISOString(),
    }));

    return NextResponse.json({ users });
  } catch (error) {
    chatPresenceLogger.error(
      { err: String(error) },
      "Error fetching chat presence:"
    );
    return NextResponse.json(
      { error: "Failed to fetch presence" },
      { status: 500 }
    );
  }
}

// POST - Heartbeat / join chat. Supply ?roomId=... to scope the heartbeat
// to a specific creator room (required for per-creator chats).
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");

    await db.chatPresence.upsert({
      where: {
        userId_roomId: { userId: session.user.id, roomId: roomId || null },
      },
      update: { lastActiveAt: new Date() },
      create: {
        userId: session.user.id,
        roomId: roomId || null,
        lastActiveAt: new Date(),
        joinedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    chatPresenceLogger.error(
      { err: String(error) },
      "Error updating chat presence:"
    );
    return NextResponse.json(
      { error: "Failed to update presence" },
      { status: 500 }
    );
  }
}

// DELETE - Leave a single room's presence (does not affect membership;
// to fully leave a room, the user calls DELETE /api/chat/rooms/:id/members).
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");

    await db.chatPresence.deleteMany({
      where: { userId: session.user.id, roomId: roomId || null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    chatPresenceLogger.error(
      { err: String(error) },
      "Error removing chat presence:"
    );
    return NextResponse.json(
      { error: "Failed to remove presence" },
      { status: 500 }
    );
  }
}
