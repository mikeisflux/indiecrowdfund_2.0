import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createLiveInput, deleteLiveInput } from "@/lib/cloudflare-stream";

const goLiveLogger = logger.child({ module: "chat-stream-start" });

export const dynamic = "force-dynamic";

// POST /api/chat/rooms/[roomId]/stream/start
// Owner-only. Provisions a Cloudflare Stream live input and stores the
// ingest URL/key + playback URL on the ChatRoom. Returns the
// StreamYard-ready credentials to the caller (one-time display in the
// Go Live modal).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const room = await db.chatRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      name: true,
      ownerUserIds: true,
      liveSessionId: true,
    },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (!room.ownerUserIds.includes(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Drop any stale live input from a prior session before minting a new
  // one — Cloudflare bills for idle inputs and we don't want orphans.
  if (room.liveSessionId) {
    await deleteLiveInput(room.liveSessionId).catch(() => {});
  }

  let live;
  try {
    live = await createLiveInput({ name: room.name, roomId: room.id });
  } catch (err) {
    goLiveLogger.error({ err: String(err) }, "createLiveInput threw");
    return NextResponse.json(
      { error: "Failed to provision Cloudflare live input" },
      { status: 502 }
    );
  }
  if (!live) {
    return NextResponse.json(
      { error: "Cloudflare Stream is not configured" },
      { status: 503 }
    );
  }

  const ingestUrl = live.rtmpsUrl.endsWith("/")
    ? live.rtmpsUrl
    : `${live.rtmpsUrl}/`;

  await db.chatRoom.update({
    where: { id: roomId },
    data: {
      rtmpEnabled: true,
      rtmpStreamKey: live.rtmpsStreamKey || null,
      rtmpIngestUrl: ingestUrl,
      rtmpPlaybackUrl: live.playbackHls,
      liveSessionId: live.uid,
      liveStreamStartedAt: new Date(),
      viewerCount: 0,
    },
  });

  // Best-effort notification dispatch — don't block the response if the
  // notification table write fails.
  try {
    const senderName = session.user.name || "A creator";
    const otherMembers = await db.chatRoomMember.findMany({
      where: {
        roomId,
        userId: { not: session.user.id },
        notificationsEnabled: true,
      },
      select: { userId: true },
    });
    if (otherMembers.length > 0) {
      await db.notification.createMany({
        data: otherMembers.map((m) => ({
          userId: m.userId,
          type: "LIVE_STREAM_STARTED" as const,
          title: `${room.name} is live`,
          message: `${senderName} just started streaming. Tap to watch.`,
          actionUrl: `/chat/${roomId}`,
        })),
      });
    }
  } catch (err) {
    goLiveLogger.warn({ err: String(err) }, "Notification dispatch failed");
  }

  return NextResponse.json({
    success: true,
    ingestUrl,
    streamKey: live.rtmpsStreamKey,
    playbackUrl: live.playbackHls,
    liveInputUid: live.uid,
  });
}
