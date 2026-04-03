import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncAllProjectStats } from "@/lib/stats";

const adminSyncAllProjectStatsLogger = logger.child({ module: "admin-sync-all-project-stats" });

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await syncAllProjectStats();

    adminSyncAllProjectStatsLogger.info(`[Batch Sync] Updated ${result.updated}/${result.total} projects`);
    result.changes.forEach((c) => {
      adminSyncAllProjectStatsLogger.info(
        `  ${c.title}: $${c.oldAmount} → $${c.newAmount}, ${c.oldBackers} → ${c.newBackers} backers`
      );
    });

    return NextResponse.json({
      message: `Synced ${result.updated} of ${result.total} projects`,
      ...result,
    });
  } catch (error) {
    adminSyncAllProjectStatsLogger.error({ err: String(error) }, "Batch sync error:");
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
