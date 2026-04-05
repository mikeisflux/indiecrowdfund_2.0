import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncProjectStats } from "@/lib/stats";

const projectsSyncStatsLogger = logger.child({ module: "projects-sync-stats" });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify user is the project creator, a collaborator, or an admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

    const exists = await db.project.findFirst({
      where: {
        id: projectId,
        ...(!isAdmin ? {
          OR: [
            { creatorId: session.user.id },
            { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
          ],
        } : {}),
      },
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
