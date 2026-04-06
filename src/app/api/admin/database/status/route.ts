import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminDatabaseStatusLogger = logger.child({ module: "admin-database-status" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Test database connection by running a simple query
    const startTime = Date.now();
    let isConnected = false;
    let responseTime = 0;

    try {
      await db.$queryRaw`SELECT 1`;
      isConnected = true;
      responseTime = Date.now() - startTime;
    } catch {
      isConnected = false;
    }

    // Get table counts for basic stats
    const [
      userCount,
      projectCount,
      pledgeCount,
      mediaCount,
    ] = await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.project.count({ where: { deletedAt: null } }),
      db.pledge.count({ where: { deletedAt: null } }),
      db.mediaFile.count({ where: { deletedAt: null } }),
    ]);

    // Get database provider from DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL || "";
    let provider = "Unknown";
    if (databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://")) {
      provider = "PostgreSQL";
    } else if (databaseUrl.startsWith("mysql://")) {
      provider = "MySQL";
    } else if (databaseUrl.startsWith("mongodb://")) {
      provider = "MongoDB";
    } else if (databaseUrl.startsWith("file:") || databaseUrl.includes("sqlite")) {
      provider = "SQLite";
    }

    return NextResponse.json({
      status: isConnected ? "connected" : "disconnected",
      responseTime,
      provider,
      stats: {
        users: userCount,
        projects: projectCount,
        pledges: pledgeCount,
        mediaFiles: mediaCount,
      },
      // Backup info - typically handled by infrastructure
      backupInfo: {
        provider: "Infrastructure",
        message: "Database backups are managed by your hosting provider (Vercel, Railway, etc.)",
        lastBackup: null,
      },
    });
  } catch (error) {
    adminDatabaseStatusLogger.error({ err: String(error) }, "Error getting database status:");
    return NextResponse.json(
      { error: "Failed to get database status" },
      { status: 500 }
    );
  }
}
