import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const membersLogger = logger.child({ module: "chat-room-members" });

export const dynamic = "force-dynamic";

// POST - Join the room (or refresh lastReadAt / re-enable notifications).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const room = await db.chatRoom.findUnique({
    where: { id: roomId },
    select: { id: true },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  let body: { notificationsEnabled?: boolean; markRead?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // body is optional
  }

  try {
    const member = await db.chatRoomMember.upsert({
      where: { roomId_userId: { roomId, userId: session.user.id } },
      update: {
        ...(body.markRead !== false ? { lastReadAt: new Date() } : {}),
        ...(typeof body.notificationsEnabled === "boolean"
          ? { notificationsEnabled: body.notificationsEnabled }
          : {}),
      },
      create: {
        roomId,
        userId: session.user.id,
        notificationsEnabled: body.notificationsEnabled ?? true,
      },
    });
    return NextResponse.json({ member });
  } catch (error) {
    membersLogger.error({ err: formatError(error) }, "Failed to join chat room");
    return NextResponse.json(
      { error: "Failed to join room" },
      { status: 500 }
    );
  }
}

// DELETE - Leave the room. Removes membership and any active presence.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  try {
    await db.$transaction([
      db.chatRoomMember.deleteMany({
        where: { roomId, userId: session.user.id },
      }),
      db.chatPresence.deleteMany({
        where: { roomId, userId: session.user.id },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    membersLogger.error({ err: formatError(error) }, "Failed to leave chat room");
    return NextResponse.json(
      { error: "Failed to leave room" },
      { status: 500 }
    );
  }
}
