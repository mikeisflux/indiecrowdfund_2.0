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

  // Best-effort fan-out: every recipient who has an account and a reason
  // to care this creator is live gets a LIVE_STREAM_STARTED notification.
  // Three sources, deduped:
  //   1. Members of this chat room (with notifications enabled)
  //   2. Followers of any project owned by any of the room's owners
  //   3. Backers (COMPLETED pledges) of any project owned by any owner
  // Co-owners of the room and the broadcaster themselves are excluded.
  try {
    const senderName = session.user.name || "A creator";

    const ownerProjects = await db.project.findMany({
      where: { creatorId: { in: room.ownerUserIds }, deletedAt: null },
      select: {
        id: true,
        slug: true,
        status: true,
        createdAt: true,
        creator: { select: { vanityUrl: true } },
      },
    });
    const projectIds = ownerProjects.map((p: { id: string }) => p.id);

    // Pick a meaningful landing URL: the most recent LIVE project's
    // Community tab, falling back to the most recent project of any
    // status, falling back to the legacy /chat/{roomId} path.
    const liveProject =
      ownerProjects
        .filter((p) => p.status === "LIVE")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0] ??
      ownerProjects.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
    const actionUrl =
      liveProject && liveProject.creator?.vanityUrl
        ? `/projects/${liveProject.creator.vanityUrl}/${liveProject.slug}#community`
        : `/chat/${roomId}`;

    const [chatMembers, followers, backers] = await Promise.all([
      db.chatRoomMember.findMany({
        where: {
          roomId,
          userId: { not: session.user.id },
          notificationsEnabled: true,
        },
        select: { userId: true },
      }),
      projectIds.length > 0
        ? db.projectFollower.findMany({
            where: {
              projectId: { in: projectIds },
              userId: { not: null },
            },
            select: { userId: true },
          })
        : Promise.resolve([] as { userId: string | null }[]),
      projectIds.length > 0
        ? db.pledge.findMany({
            where: {
              projectId: { in: projectIds },
              status: "COMPLETED",
            },
            select: { userId: true },
            distinct: ["userId"],
          })
        : Promise.resolve([] as { userId: string }[]),
    ]);

    const targetUserIds = new Set<string>();
    for (const m of chatMembers) targetUserIds.add(m.userId);
    for (const f of followers) if (f.userId) targetUserIds.add(f.userId);
    for (const b of backers) targetUserIds.add(b.userId);
    // Exclude the broadcaster and any co-owners so they don't ping
    // themselves on every Go Live click.
    for (const ownerId of room.ownerUserIds) targetUserIds.delete(ownerId);
    targetUserIds.delete(session.user.id);

    if (targetUserIds.size > 0) {
      await db.notification.createMany({
        data: Array.from(targetUserIds).map((userId) => ({
          userId,
          type: "LIVE_STREAM_STARTED" as const,
          title: `${room.name} is live`,
          message: `${senderName} just started streaming. Tap to watch.`,
          actionUrl,
        })),
      });
      goLiveLogger.info(
        {
          roomId,
          recipients: targetUserIds.size,
          chatMembers: chatMembers.length,
          followers: followers.length,
          backers: backers.length,
        },
        "Live-stream notifications dispatched"
      );
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
