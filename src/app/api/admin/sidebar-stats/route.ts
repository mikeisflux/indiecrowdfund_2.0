import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminSidebarStatsLogger = logger.child({ module: "admin-sidebar-stats" });
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

      // Large pledges ($100+). Include committed PENDING (Stripe
      // payment-method-saved) so admin gets the notification ping
      // when a big AoN pledge lands, not just after the funded-cron
      // converts it.
      db.pledge.count({
        where: {
          amount: { gte: 10000 },
          createdAt: { gte: oneWeekAgo },
          ...(allReadBefore ? { createdAt: { gte: allReadBefore } } : {}),
          OR: [
            { status: "COMPLETED" },
            { status: "PENDING", confirmationEmailSent: true },
          ],
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
      unresolvedErrors,
    ] = await Promise.all([
      // Total users count (exclude soft-deleted)
      db.user.count({ where: { deletedAt: null } }),

      // Total projects count (exclude soft-deleted)
      db.project.count({ where: { deletedAt: null } }),

      // Pending moderation (reports needing action)
      db.report.count({
        where: {
          status: { in: ["PENDING", "UNDER_REVIEW", "ESCALATED"] },
        },
      }),

      // Pending payouts (DC and PayPal projects needing payout - FUNDED or LIVE with endDate passed & goal met)
      // Stripe uses auto Connect payouts so only DC and PayPal projects need manual payouts
      db.project.count({
        where: {
          deletedAt: null,
          paymentProcessor: { in: ["DIVINITYCOIN", "PAYPAL"] },
          OR: [
            { status: "FUNDED" },
            {
              status: "LIVE",
              fundedAt: { not: null },
              endDate: { lt: new Date() },
            },
          ],
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

      // Unresolved error logs
      db.errorGroup.count({
        where: { status: "UNRESOLVED" },
      }).catch(() => 0),
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

    const response = NextResponse.json({
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
      errorLogs: unresolvedErrors,
    });

    // Cache for 30 seconds to avoid hammering the DB on every navigation
    response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");

    return response;
  } catch (error) {
    adminSidebarStatsLogger.error({ err: String(error) }, "Error fetching sidebar stats:");
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
