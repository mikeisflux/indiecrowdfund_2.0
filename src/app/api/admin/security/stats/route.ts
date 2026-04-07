import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminSecurityStatsLogger = logger.child({ module: "admin-security-stats" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify super admin
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Count active users (non-expired sessions)
    const activeUsers = await db.session.count({
      where: {
        expires: { gt: new Date() },
      },
    });

    // Count blocked IPs
    const blockedIPs = await db.blockedIP.count();

    // Count accounts with failed login attempts in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failedLogins24h = await db.user.count({
      where: {
        failedLoginAttempts: { gt: 0 },
        lastFailedLoginAt: { gte: oneDayAgo },
      },
    });

    return NextResponse.json({
      activeUsers,
      blockedIPs,
      failedLogins24h,
      users2FAEnabled: 0, // 2FA not yet implemented in schema
    });
  } catch (error) {
    adminSecurityStatsLogger.error({ err: String(error) }, "Security stats error:");
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
