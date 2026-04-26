import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const roomsLogger = logger.child({ module: "chat-rooms-resolve" });

export const dynamic = "force-dynamic";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "creator";
}

// GET /api/chat/rooms/resolve?creatorId=<userId>
// Returns the chat room owned by that creator, creating it on demand the
// first time it's requested. Used by project Community tabs to embed the
// creator's branded room. Open to any authenticated user — backers need
// to read room metadata to join the chat.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creatorId");
    if (!creatorId) {
      return NextResponse.json(
        { error: "creatorId query param required" },
        { status: 400 }
      );
    }

    const creator = await db.user.findFirst({
      where: { id: creatorId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // First, look for any room where this creator is an owner — covers
    // the shared-account case (e.g. personal + company accounts merged
    // into one room).
    let room = await db.chatRoom.findFirst({
      where: { ownerUserIds: { has: creator.id } },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerUserId: true,
        ownerUserIds: true,
        rtmpEnabled: true,
      },
    });

    if (!room) {
      // Lazily create a fresh room on first request.
      const brand = creator.name?.trim() || "Creator";
      const baseSlug = slugify(brand);
      // Avoid slug collisions by appending a short suffix when needed.
      let slug = baseSlug;
      let attempt = 0;
      while (await db.chatRoom.findUnique({ where: { slug } })) {
        attempt += 1;
        slug = `${baseSlug}-${creator.id.slice(-4)}${attempt > 1 ? `-${attempt}` : ""}`;
      }

      room = await db.chatRoom.create({
        data: {
          name: `${brand}'s Chat`,
          slug,
          ownerUserId: creator.id,
          ownerUserIds: [creator.id],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          ownerUserId: true,
          ownerUserIds: true,
          rtmpEnabled: true,
        },
      });
      roomsLogger.info(
        { roomId: room.id, ownerUserId: creator.id },
        "Created creator chat room"
      );
    }

    return NextResponse.json({ room });
  } catch (error) {
    roomsLogger.error({ err: String(error) }, "Failed to resolve chat room");
    return NextResponse.json(
      { error: "Failed to resolve chat room" },
      { status: 500 }
    );
  }
}
