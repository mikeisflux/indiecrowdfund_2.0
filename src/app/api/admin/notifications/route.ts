import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminNotificationsLogger = logger.child({ module: "admin-notifications" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }
  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });
  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden", status: 403 };
  }
  return { user: session.user };
}

interface AdminNotification {
  id: string;
  type: "project" | "user" | "payment" | "alert" | "message";
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

// GET - Fetch admin notifications from real system events
export async function GET(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    // Validate limit parameter
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const type = searchParams.get("type");
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    // Get admin's read notifications from their preferences (stored in AdminSetting or a cache)
    const adminId = authResult.user.id;
    const readNotifications = await getReadNotificationIds(adminId);

    const notifications: AdminNotification[] = [];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch recent events from various tables in parallel
    const [
      recentProjects,
      recentUsers,
      largePledges,
      pendingProjects,
      recentBugReports,
    ] = await Promise.all([
      // New projects submitted in last week
      db.project.findMany({
        where: {
          createdAt: { gte: oneWeekAgo },
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          createdAt: true,
          creator: { select: { name: true, vanityUrl: true } },
        },
      }),

      // New users in last week
      db.user.findMany({
        where: {
          createdAt: { gte: oneWeekAgo },
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),

      // Large pledges ($100+) in last week
      db.pledge.findMany({
        where: {
          createdAt: { gte: oneWeekAgo },
          // Pledge.amount is a Decimal in DOLLARS, not cents. This read
          // `gte: 10000` commented as "100 dollars in cents", so the
          // threshold was actually $10,000 and the notification never fired.
          amount: { gte: 100 },
          status: "COMPLETED",
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          createdAt: true,
          project: { select: { id: true, title: true } },
          user: { select: { name: true } },
        },
      }),

      // Projects pending review (SUBMITTED status = awaiting review)
      db.project.findMany({
        where: {
          status: "SUBMITTED",
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          createdAt: true,
          creator: { select: { name: true } },
        },
      }),

      // Recent bug reports (NEW or IN_PROGRESS status)
      db.bugReport.findMany({
        where: {
          createdAt: { gte: oneWeekAgo },
          status: { in: ["NEW", "IN_PROGRESS"] },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          priority: true,
          createdAt: true,
          name: true,
          user: { select: { name: true } },
        },
      }),
    ]);

    // Convert events to notifications

    // New project submissions
    for (const project of recentProjects) {
      if (project.status === "SUBMITTED" || project.status === "DRAFT") {
        const notifId = `project-new-${project.id}`;
        if (!type || type === "project") {
          notifications.push({
            id: notifId,
            type: "project",
            title: "New Project Submitted",
            message: `"${project.title}" by ${project.creator?.name || "Unknown"} is awaiting review`,
            read: readNotifications.has(notifId),
            createdAt: project.createdAt,
            actionUrl: `/admin/projects/${project.id}`,
            metadata: { projectId: project.id },
          });
        }
      } else if (project.status === "LIVE") {
        const notifId = `project-live-${project.id}`;
        if (!type || type === "project") {
          // Build project URL with vanity URL if available
          const projectUrl = project.creator?.vanityUrl
            ? `/projects/${project.creator.vanityUrl}/${project.slug}`
            : `/projects/${project.slug}`;
          notifications.push({
            id: notifId,
            type: "project",
            title: "Project Launched",
            message: `"${project.title}" is now live on the platform`,
            read: readNotifications.has(notifId),
            createdAt: project.createdAt,
            actionUrl: projectUrl,
            metadata: { projectId: project.id },
          });
        }
      }
    }

    // Funded projects
    const fundedProjects = recentProjects.filter(p => p.status === "FUNDED");
    for (const project of fundedProjects) {
      const notifId = `project-funded-${project.id}`;
      if (!type || type === "project") {
        // Build project URL with vanity URL if available
        const projectUrl = project.creator?.vanityUrl
          ? `/projects/${project.creator.vanityUrl}/${project.slug}`
          : `/projects/${project.slug}`;
        notifications.push({
          id: notifId,
          type: "project",
          title: "Project Funded",
          message: `"${project.title}" reached its funding goal`,
          read: readNotifications.has(notifId),
          createdAt: project.createdAt,
          actionUrl: projectUrl,
          metadata: { projectId: project.id },
        });
      }
    }

    // New user registrations
    for (const user of recentUsers) {
      const notifId = `user-new-${user.id}`;
      if (!type || type === "user") {
        const isRetailer = user.role === "RETAILER";
        notifications.push({
          id: notifId,
          type: "user",
          title: isRetailer ? "Retailer Application" : "New User Registration",
          message: `${user.name || user.email} has ${isRetailer ? "applied for retailer access" : "created a new account"}`,
          read: readNotifications.has(notifId),
          createdAt: user.createdAt,
          actionUrl: `/admin/users/${user.id}`,
          metadata: { userId: user.id },
        });
      }
    }

    // Large pledges
    for (const pledge of largePledges) {
      const notifId = `pledge-large-${pledge.id}`;
      if (!type || type === "payment") {
        const amount = Number(pledge.amount).toFixed(2);
        notifications.push({
          id: notifId,
          type: "payment",
          title: "Large Pledge Received",
          message: `$${amount} pledge received for "${pledge.project?.title || "Unknown Project"}"`,
          read: readNotifications.has(notifId),
          createdAt: pledge.createdAt,
          actionUrl: pledge.project ? `/admin/projects/${pledge.project.id}` : undefined,
          metadata: { pledgeId: pledge.id, amount: Number(pledge.amount) },
        });
      }
    }

    // Bug reports (support messages)
    for (const report of recentBugReports) {
      const notifId = `bug-${report.id}`;
      if (!type || type === "message") {
        notifications.push({
          id: notifId,
          type: "message",
          title: report.priority === "HIGH" || report.priority === "CRITICAL" ? "Urgent Support Request" : "Support Request",
          message: `${report.title} - from ${report.user?.name || report.name || "Unknown"}`,
          read: readNotifications.has(notifId),
          createdAt: report.createdAt,
          actionUrl: `/admin/bug-reports/${report.id}`,
          metadata: { reportId: report.id, priority: report.priority },
        });
      }
    }

    // Pending projects alert
    if (pendingProjects.length > 0 && (!type || type === "alert")) {
      const notifId = `pending-projects-${new Date().toDateString()}`;
      notifications.push({
        id: notifId,
        type: "alert",
        title: "Projects Awaiting Review",
        message: `${pendingProjects.length} project${pendingProjects.length > 1 ? "s" : ""} pending approval`,
        read: readNotifications.has(notifId),
        createdAt: pendingProjects[0].createdAt,
        actionUrl: "/admin/projects?status=PENDING",
        metadata: { count: pendingProjects.length },
      });
    }

    // Sort by date (newest first) and apply filters
    let sortedNotifications = notifications.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    if (unreadOnly) {
      sortedNotifications = sortedNotifications.filter(n => !n.read);
    }

    // Limit results
    sortedNotifications = sortedNotifications.slice(0, limit);

    // Calculate stats
    const unreadCount = notifications.filter(n => !n.read).length;
    const todayCount = notifications.filter(
      n => n.createdAt > oneDayAgo
    ).length;

    return NextResponse.json({
      notifications: sortedNotifications,
      stats: {
        total: notifications.length,
        unread: unreadCount,
        today: todayCount,
        thisWeek: notifications.length,
      },
    });
  } catch (error) {
    adminNotificationsLogger.error({ err: formatError(error) }, "Error fetching admin notifications:");
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// POST - Mark notifications as read or update preferences
export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { action, notificationIds, preferences } = body;
    const adminId = authResult.user.id;

    if (action === "markRead") {
      if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
        return NextResponse.json({ error: "notificationIds array required" }, { status: 400 });
      }
      // Store read notification IDs in admin settings
      await markNotificationsAsRead(adminId, notificationIds);
      return NextResponse.json({ success: true, marked: notificationIds.length });
    }

    if (action === "markAllRead") {
      // Mark all current notifications as read
      await markAllNotificationsAsRead(adminId);
      return NextResponse.json({ success: true });
    }

    if (action === "updatePreferences" && preferences) {
      // Update notification preferences
      await updateNotificationPreferences(adminId, preferences);
      return NextResponse.json({ success: true, preferences });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    adminNotificationsLogger.error({ err: formatError(error) }, "Error updating notifications:");
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}

// Helper functions for managing read state
async function getReadNotificationIds(adminId: string): Promise<Set<string>> {
  try {
    const setting = await db.adminSetting.findUnique({
      where: { key: `admin_read_notifications_${adminId}` },
    });
    if (setting?.value) {
      const data = setting.value as { readIds?: string[] };
      return new Set(data.readIds || []);
    }
  } catch {
    // Ignore errors, return empty set
  }
  return new Set();
}

async function markNotificationsAsRead(adminId: string, notificationIds: string[]) {
  const key = `admin_read_notifications_${adminId}`;
  const existing = await getReadNotificationIds(adminId);

  for (const id of notificationIds) {
    existing.add(id);
  }

  // Keep only last 500 read IDs to prevent unbounded growth
  const readIds = Array.from(existing).slice(-500);

  await db.adminSetting.upsert({
    where: { key },
    create: {
      key,
      value: { readIds },
      description: "Admin read notification IDs",
    },
    update: {
      value: { readIds },
    },
  });
}

async function markAllNotificationsAsRead(adminId: string) {
  // Generate all current notification IDs and mark them as read
  // For simplicity, we'll just store the current timestamp
  const key = `admin_read_notifications_${adminId}`;

  await db.adminSetting.upsert({
    where: { key },
    create: {
      key,
      value: { allReadBefore: new Date().toISOString(), readIds: [] },
      description: "Admin read notification IDs",
    },
    update: {
      value: { allReadBefore: new Date().toISOString(), readIds: [] },
    },
  });
}

async function updateNotificationPreferences(
  adminId: string,
  preferences: Record<string, boolean>
) {
  const key = `admin_notification_prefs_${adminId}`;

  await db.adminSetting.upsert({
    where: { key },
    create: {
      key,
      value: preferences,
      description: "Admin notification preferences",
    },
    update: {
      value: preferences,
    },
  });
}
