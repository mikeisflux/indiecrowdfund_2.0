import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Calculate unread notifications for an admin
async function calculateUnreadNotifications(adminId: string): Promise<number> {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get read notification state
    const setting = await db.adminSetting.findUnique({
      where: { key: `admin_read_notifications_${adminId}` },
    });

    const readState = setting?.value as { readIds?: string[]; allReadBefore?: string } | null;
    const readIds = new Set(readState?.readIds || []);
    const allReadBefore = readState?.allReadBefore ? new Date(readState.allReadBefore) : null;

    // Count unread events from various sources
    const [
      pendingProjects,
      recentUsers,
      largePledges,
      bugReports,
    ] = await Promise.all([
      // Pending projects (SUBMITTED status = awaiting review)
      db.project.count({
        where: {
          status: "SUBMITTED",
          createdAt: { gte: oneWeekAgo },
          ...(allReadBefore ? { createdAt: { gte: allReadBefore } } : {}),
        },
      }),

      // New users (last week)
      db.user.count({
        where: {
          createdAt: { gte: oneWeekAgo },
          ...(allReadBefore ? { createdAt: { gte: allReadBefore } } : {}),
        },
      }),

      // Large pledges ($100+)
      db.pledge.count({
        where: {
          amount: { gte: 10000 },
          status: "COMPLETED",
          createdAt: { gte: oneWeekAgo },
          ...(allReadBefore ? { createdAt: { gte: allReadBefore } } : {}),
        },
      }),

      // Bug reports (NEW or IN_PROGRESS status)
      db.bugReport.count({
        where: {
          status: { in: ["NEW", "IN_PROGRESS"] },
          createdAt: { gte: oneWeekAgo },
          ...(allReadBefore ? { createdAt: { gte: allReadBefore } } : {}),
        },
      }),
    ]);

    // Total potential notifications
    let total = pendingProjects + recentUsers + largePledges + bugReports;

    // Subtract read ones (rough estimate - exact count would require generating all IDs)
    total = Math.max(0, total - readIds.size);

    return total;
  } catch {
    return 0;
  }
}

export async function GET() {
  // Verify admin access
  const session = await validateSession();
  if (!session || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all counts in parallel for performance
    const [
      totalUsers,
      totalProjects,
      pendingModeration,
      pendingPayouts,
      unreadNotifications,
      totalMedia,
      newBugReports,
      pendingRetailers,
      pendingPrelaunch,
    ] = await Promise.all([
      // Total users count
      db.user.count(),

      // Total projects count
      db.project.count(),

      // Pending moderation (reports needing action)
      db.report.count({
        where: {
          status: { in: ["PENDING", "UNDER_REVIEW", "ESCALATED"] },
        },
      }),

      // Pending payouts (funded DC projects - Stripe uses auto Connect payouts)
      db.project.count({
        where: {
          status: "FUNDED",
          paymentProcessor: "DIVINITYCOIN",
        },
      }),

      // Count unread admin notifications (virtual notifications from system events)
      calculateUnreadNotifications(session.user.id),

      // Total media files
      db.mediaFile.count(),

      // New/acknowledged bug reports
      db.bugReport.count({
        where: {
          status: { in: ["NEW", "ACKNOWLEDGED"] },
        },
      }),

      // Pending retailer applications
      db.retailer.count({
        where: {
          status: "PENDING",
        },
      }),

      // Pending prelaunch pages (awaiting review)
      db.project.count({
        where: {
          prelaunchStatus: "SUBMITTED",
          deletedAt: null,
        },
      }),
    ]);

    // Format large numbers
    const formatCount = (count: number): string => {
      if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
      }
      if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`;
      }
      return count.toString();
    };

    return NextResponse.json({
      users: formatCount(totalUsers),
      usersRaw: totalUsers,
      projects: formatCount(totalProjects),
      projectsRaw: totalProjects,
      moderation: pendingModeration,
      payouts: pendingPayouts,
      notifications: unreadNotifications,
      media: formatCount(totalMedia),
      mediaRaw: totalMedia,
      bugReports: newBugReports,
      retailers: pendingRetailers,
      prelaunch: pendingPrelaunch,
    });
  } catch (error) {
    console.error("Error fetching sidebar stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
