import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/chat/rooms/[roomId]/stream/status
// Returns current live-stream state for any authenticated viewer.
export async function GET(
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
      rtmpEnabled: true,
      rtmpPlaybackUrl: true,
      liveStreamStartedAt: true,
      viewerCount: true,
      ownerUserIds: true,
    },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json({
    live: !!room.rtmpEnabled,
    playbackUrl: room.rtmpPlaybackUrl ?? null,
    startedAt: room.liveStreamStartedAt?.toISOString() ?? null,
    viewerCount: room.viewerCount ?? 0,
    isOwner: room.ownerUserIds.includes(session.user.id),
  });
}
