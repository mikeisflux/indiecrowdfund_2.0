import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/chat/rooms/me
// List every chat room the current user is a member of, with their
// per-room notification toggle. Used by the notification-preferences
// section in profile settings.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await db.chatRoomMember.findMany({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "desc" },
    include: {
      room: {
        select: {
          id: true,
          name: true,
          slug: true,
          ownerUserId: true,
        },
      },
    },
  });

  type MembershipRow = {
    roomId: string;
    notificationsEnabled: boolean;
    joinedAt: Date;
    room: {
      id: string;
      name: string;
      slug: string;
      ownerUserId: string;
    };
  };
  const rooms = (memberships as MembershipRow[]).map((m) => ({
    roomId: m.roomId,
    name: m.room.name,
    slug: m.room.slug,
    notificationsEnabled: m.notificationsEnabled,
    isOwner: m.room.ownerUserId === session.user.id,
    joinedAt: m.joinedAt.toISOString(),
  }));

  return NextResponse.json({ rooms });
}
