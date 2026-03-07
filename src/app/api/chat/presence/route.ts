import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const chatPresenceLogger = logger.child({ module: "chat-presence" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const INACTIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const REMOVE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

// GET - Fetch active users in chat
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const removeThreshold = new Date(now.getTime() - REMOVE_THRESHOLD_MS);

    // Clean up users inactive for 30+ minutes
    await db.chatPresence.deleteMany({
      where: { lastActiveAt: { lt: removeThreshold } },
    });

    // Fetch remaining presence records
    const presenceRecords = await db.chatPresence.findMany({
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
      orderBy: { lastActiveAt: "desc" },
    });

    const inactiveThreshold = new Date(now.getTime() - INACTIVE_THRESHOLD_MS);

    const users = presenceRecords.map((record: { user: { id: string; name: string | null; image: string | null; vanityUrl: string | null }; lastActiveAt: Date }) => ({
      ...record.user,
      status:
        record.lastActiveAt >= inactiveThreshold ? "active" as const : "inactive" as const,
      lastActiveAt: record.lastActiveAt.toISOString(),
    }));

    return NextResponse.json({ users });
  } catch (error) {
    chatPresenceLogger.error({ err: String(error) }, "Error fetching chat presence:");
    return NextResponse.json(
      { error: "Failed to fetch presence" },
      { status: 500 }
    );
  }
}

// POST - Heartbeat / join chat
export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.chatPresence.upsert({
      where: { userId: session.user.id },
      update: { lastActiveAt: new Date() },
      create: {
        userId: session.user.id,
        lastActiveAt: new Date(),
        joinedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    chatPresenceLogger.error({ err: String(error) }, "Error updating chat presence:");
    return NextResponse.json(
      { error: "Failed to update presence" },
      { status: 500 }
    );
  }
}

// DELETE - Leave chat
export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.chatPresence.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    chatPresenceLogger.error({ err: String(error) }, "Error removing chat presence:");
    return NextResponse.json(
      { error: "Failed to remove presence" },
      { status: 500 }
    );
  }
}
