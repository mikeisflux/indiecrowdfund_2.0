import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminSidebarStatsLogger = logger.child({ module: "admin-sidebar-stats" });
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { OPEN_BUG_STATUSES } from "@/lib/bug-report-status";

export const dynamic = "force-dynamic";

// Calculate unread notifications for an admin.
//
// This must agree with /api/admin/notifications, which is what the bell
// actually opens. It previously did not, in three ways:
//
//   1. `createdAt` was written twice in each where-clause —
//      `createdAt: { gte: oneWeekAgo }` followed by a spread that set
//      `createdAt` again. Object spread overwrites, so the one-week bound was
//      silently discarded whenever allReadBefore was set, widening the window
//      instead of narrowing it.
//   2. Read items were removed by subtracting `readIds.size` from the total —
//      arithmetic between two unrelated sets. Reading a notification that had
//      already aged out of the window still decremented the badge, so it drifted
//      low; ids for types this function does not count decremented it too. That
//      is why the badge did not settle after things were read.
//   3. Large pledges were `amount >= 10000` commented as "100 dollars in
//      cents", but Pledge.amount is a Decimal in DOLLARS. The threshold was
//      $10,000, so the notification effectively never fired.
//
// Ids are now generated in the same format as the notifications route and
// checked against readIds individually, which is what makes a read
// notification actually stay read.
async function calculateUnreadNotifications(adminId: string): Promise<number> {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const setting = await db.adminSetting.findUnique({
      where: { key: `admin_read_notifications_${adminId}` },
    });

    const readState = setting?.value as { readIds?: string[]; allReadBefore?: string } | null;
    const readIds = new Set(readState?.readIds || []);
    const allReadBefore = readState?.allReadBefore ? new Date(readState.allReadBefore) : null;

    // "Mark all read" moves the floor forward; the week bound still applies.
    // The later of the two is the correct lower bound.
    const since =
      allReadBefore && allReadBefore > oneWeekAgo ? allReadBefore : oneWeekAgo;

    const [projects, users, pledges, bugs] = await Promise.all([
      db.project.findMany({
        where: { status: "SUBMITTED", createdAt: { gte: since } },
        select: { id: true },
      }),
      db.user.findMany({
        where: { createdAt: { gte: since } },
        select: { id: true },
      }),
      db.pledge.findMany({
        where: {
          amount: { gte: 100 },
          createdAt: { gte: since },
          deletedAt: null,
          OR: [
            { status: "COMPLETED" },
            { status: "PENDING", confirmationEmailSent: true },
          ],
        },
        select: { id: true },
      }),
      db.bugReport.findMany({
        where: { status: { in: [...OPEN_BUG_STATUSES] }, createdAt: { gte: since } },
        select: { id: true },
      }),
    ]);

    const ids = [
      ...projects.map((p: { id: string }) => `project-new-${p.id}`),
      ...users.map((u: { id: string }) => `user-new-${u.id}`),
      ...pledges.map((p: { id: string }) => `pledge-large-${p.id}`),
      ...bugs.map((b: { id: string }) => `bug-${b.id}`),
    ];

    return ids.filter((id) => !readIds.has(id)).length;
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

      // Open bug reports. Uses the shared definition so the badge can never
      // again disagree with what the Bug Reports page calls open.
      db.bugReport.count({
        where: {
          status: { in: [...OPEN_BUG_STATUSES] },
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
    adminSidebarStatsLogger.error({ err: formatError(error) }, "Error fetching sidebar stats:");
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
