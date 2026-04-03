import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { syncProjectStats } from "@/lib/stats";

const projectsSyncStatsLogger = logger.child({ module: "projects-sync-stats" });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const exists = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const result = await syncProjectStats(projectId);

    if (!result.updated) {
      return NextResponse.json({
        message: "Stats already in sync",
        currentAmount: result.currentAmount,
        backerCount: result.backerCount,
        updated: false,
      });
    }

    projectsSyncStatsLogger.info(
      `[Sync] Project ${projectId}: $${result.previousAmount} → $${result.currentAmount}, ${result.previousBackerCount} → ${result.backerCount} backers`
    );

    return NextResponse.json({
      message: "Stats synced successfully",
      previousAmount: result.previousAmount,
      previousBackerCount: result.previousBackerCount,
      currentAmount: result.currentAmount,
      backerCount: result.backerCount,
      updated: true,
    });
  } catch (error) {
    projectsSyncStatsLogger.error({ err: String(error) }, "Failed to sync project stats:");
    return NextResponse.json({ error: "Failed to sync project stats" }, { status: 500 });
  }
}
