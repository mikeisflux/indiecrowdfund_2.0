import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const userNotificationsLogger = logger.child({ module: "user-notifications" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { markAsRead, markAllAsRead } from "@/lib/notifications";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Client disconnects (tab close, timeout, navigation mid-request) surface
// as AbortError / DOMException / "Error: aborted" from req.json() or Prisma.
// They're not server bugs — just stop logging them as errors so the PM2
// logs aren't buried in noise every time someone closes a tab.
function isClientAbort(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  const message = (error as { message?: string }).message || "";
  return (
    name === "AbortError" ||
    name === "DOMException" ||
    message === "aborted" ||
    message.includes("aborted") ||
    message.includes("request aborted")
  );
}

// GET - Fetch user notifications
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    // Validate pagination parameters
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0") || 0);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    // Build where clause
    const where: { userId: string; read?: boolean } = {
      userId: session.user.id,
    };

    if (unreadOnly) {
      where.read = false;
    }

    // Fetch notifications and counts
    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          read: true,
          actionUrl: true,
          projectId: true,
          createdAt: true,
        },
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: { userId: session.user.id, read: false },
      }),
    ]);

    return NextResponse.json({
      notifications,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      unreadCount,
    });
  } catch (error) {
    if (!isClientAbort(error)) {
      userNotificationsLogger.error({ err: String(error) }, "Error fetching notifications:");
    }
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// PATCH - Mark notifications as read
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, notificationIds } = body;

    if (action === "markAllRead") {
      await markAllAsRead(session.user.id);
      return NextResponse.json({ success: true });
    }

    if (action === "markRead" && notificationIds?.length > 0) {
      // Verify the notifications belong to this user
      const notifications = await db.notification.findMany({
        where: {
          id: { in: notificationIds },
          userId: session.user.id,
        },
        select: { id: true },
      });

      const validIds = notifications.map((n) => n.id);
      if (validIds.length > 0) {
        await markAsRead(validIds);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (!isClientAbort(error)) {
      userNotificationsLogger.error({ err: String(error) }, "Error updating notifications:");
    }
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}

// DELETE - Delete notifications
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const notificationId = searchParams.get("id");
    const deleteAll = searchParams.get("all") === "true";

    if (deleteAll) {
      await db.notification.deleteMany({
        where: { userId: session.user.id },
      });
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      // Scoped delete via deleteMany — enforces user ownership and
      // resolves concurrent double-clicks as { count: 0 } instead of P2025.
      const deleted = await db.notification.deleteMany({
        where: {
          id: notificationId,
          userId: session.user.id,
        },
      });

      if (deleted.count === 0) {
        return NextResponse.json(
          { error: "Notification not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Notification ID required" },
      { status: 400 }
    );
  } catch (error) {
    if (!isClientAbort(error)) {
      userNotificationsLogger.error({ err: String(error) }, "Error deleting notification:");
    }
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    );
  }
}
