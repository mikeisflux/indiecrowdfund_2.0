import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminSyncAllProjectStatsLogger = logger.child({ module: "admin-sync-all-project-stats" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/sync-all-project-stats
 *
 * Batch sync all project stats to match actual COMPLETED pledges.
 * For LIVE projects not yet at goal, includes committed pending pledges.
 * This fixes stored currentAmount and backerCount fields across all projects.
 */
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

    // Get all active projects
    const projects = await db.project.findMany({
      where: {
        status: { in: ["LIVE", "FUNDED", "FAILED"] },
        deletedAt: null,
      },
      select: {
        id: true,
        currentAmount: true,
        backerCount: true,
        goalAmount: true,
        status: true,
        title: true,
      },
    });

    let updated = 0;
    const changes: { title: string; oldAmount: number; newAmount: number; oldBackers: number; newBackers: number }[] = [];

    for (const project of projects) {
      const goalAmount = Number(project.goalAmount);

      // Get COMPLETED pledge totals
      const completedStats = await db.pledge.aggregate({
        where: {
          projectId: project.id,
          status: "COMPLETED",
          deletedAt: null,
        },
        _sum: { amount: true },
        _count: { id: true },
      });

      let newAmount = Number(completedStats._sum.amount || 0);
      let newBackerCount = completedStats._count.id || 0;

      // For LIVE projects that haven't met goal, include confirmed pending pledges
      // confirmationEmailSent = true means checkout was completed and card was stored
      if (project.status === "LIVE" && newAmount < goalAmount) {
        const pendingStats = await db.pledge.aggregate({
          where: {
            projectId: project.id,
            status: "PENDING",
            deletedAt: null,
            confirmationEmailSent: true,
          },
          _sum: { amount: true },
          _count: { id: true },
        });

        newAmount += Number(pendingStats._sum.amount || 0);
        newBackerCount += (pendingStats._count.id || 0);
      }

      const oldAmount = Number(project.currentAmount);
      const oldBackerCount = project.backerCount;

      if (oldAmount !== newAmount || oldBackerCount !== newBackerCount) {
        await db.project.update({
          where: { id: project.id },
          data: {
            currentAmount: newAmount,
            backerCount: newBackerCount,
          },
        });
        updated++;
        changes.push({
          title: project.title,
          oldAmount,
          newAmount,
          oldBackers: oldBackerCount,
          newBackers: newBackerCount,
        });
      }
    }

    adminSyncAllProjectStatsLogger.info(`[Batch Sync] Updated ${updated}/${projects.length} projects`);
    changes.forEach(c => {
      adminSyncAllProjectStatsLogger.info(`  ${c.title}: $${c.oldAmount} → $${c.newAmount}, ${c.oldBackers} → ${c.newBackers} backers`);
    });

    return NextResponse.json({
      message: `Synced ${updated} of ${projects.length} projects`,
      updated,
      total: projects.length,
      changes,
    });
  } catch (error) {
    adminSyncAllProjectStatsLogger.error({ err: String(error) }, "Batch sync error:");
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
