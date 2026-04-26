import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteLiveInput } from "@/lib/cloudflare-stream";
import { logger } from "@/lib/logger";

const stopLogger = logger.child({ module: "chat-stream-stop" });

export const dynamic = "force-dynamic";

// POST /api/chat/rooms/[roomId]/stream/stop
// Owner-only. Tears down the Cloudflare live input and clears RTMP fields.
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

  if (room.liveSessionId) {
    const ok = await deleteLiveInput(room.liveSessionId);
    if (!ok) {
      stopLogger.warn(
        { uid: room.liveSessionId },
        "Live input delete failed; clearing local state anyway"
      );
    }
  }

  await db.chatRoom.update({
    where: { id: roomId },
    data: {
      rtmpEnabled: false,
      rtmpStreamKey: null,
      rtmpIngestUrl: null,
      rtmpPlaybackUrl: null,
      liveSessionId: null,
      liveStreamStartedAt: null,
      viewerCount: 0,
    },
  });

  return NextResponse.json({ success: true });
}
