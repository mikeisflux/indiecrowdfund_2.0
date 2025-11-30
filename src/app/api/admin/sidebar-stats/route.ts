import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

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
    ] = await Promise.all([
      // Total users count
      db.user.count(),

      // Total projects count
      db.project.count(),

      // Pending moderation (projects awaiting review - using SUBMITTED status)
      db.project.count({
        where: {
          status: "SUBMITTED",
        },
      }),

      // Pending payouts (funded projects)
      db.project.count({
        where: {
          status: "FUNDED",
        },
      }),

      // Count of unseen/unread admin notifications (if you have a notification system)
      // For now, we'll return 0 or you can add notification tracking
      Promise.resolve(0),

      // Total media files
      db.mediaFile.count(),
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
    });
  } catch (error) {
    console.error("Error fetching sidebar stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
