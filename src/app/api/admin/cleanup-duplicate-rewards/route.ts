import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const cleanupLogger = logger.child({ module: "cleanup-duplicate-rewards" });

// GET - Preview duplicate rewards that would be cleaned up
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Find duplicate addons grouped by title + amount
    const allAddons = await db.reward.findMany({
      where: { projectId, type: "ADDON", deletedAt: null },
      include: {
        _count: { select: { pledges: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by title + amount
    const groups: Record<string, typeof allAddons> = {};
    for (const addon of allAddons) {
      const key = `${addon.title}|${Number(addon.amount)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(addon);
    }

    // Only show groups with duplicates
    const duplicateGroups = Object.entries(groups)
      .filter(([, addons]) => addons.length > 1)
      .map(([key, addons]) => ({
        key,
        title: addons[0].title,
        amount: Number(addons[0].amount),
        totalCopies: addons.length,
        keepId: addons[0].id, // oldest one
        deleteIds: addons.slice(1).map(a => a.id),
        totalPledgesOnDuplicates: addons.slice(1).reduce((sum, a) => sum + a._count.pledges, 0),
        pledgesOnKeep: addons[0]._count.pledges,
      }));

    return NextResponse.json({
      projectId,
      duplicateGroups,
      totalDuplicatesToRemove: duplicateGroups.reduce((sum, g) => sum + g.deleteIds.length, 0),
    });
  } catch (error) {
    cleanupLogger.error({ err: formatError(error) }, "Preview cleanup error:");
    return NextResponse.json({ error: "Failed to preview cleanup" }, { status: 500 });
  }
}

// POST - Execute cleanup: merge pledges to keeper, delete duplicates
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Find duplicate addons grouped by title + amount
    const allAddons = await db.reward.findMany({
      where: { projectId, type: "ADDON", deletedAt: null },
      include: {
        _count: { select: { pledges: true } },
        pledges: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by title + amount
    const groups: Record<string, typeof allAddons> = {};
    for (const addon of allAddons) {
      const key = `${addon.title}|${Number(addon.amount)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(addon);
    }

    let totalMerged = 0;
    let totalDeleted = 0;

    for (const [, addons] of Object.entries(groups)) {
      if (addons.length <= 1) continue;

      const keeper = addons[0]; // oldest
      const duplicates = addons.slice(1);

      await db.$transaction(async (tx) => {
        for (const dup of duplicates) {
          // Move any pledges from duplicate to keeper
          if (dup._count.pledges > 0) {
            await tx.pledge.updateMany({
              where: { rewardId: dup.id },
              data: { rewardId: keeper.id },
            });
            totalMerged += dup._count.pledges;
            cleanupLogger.info(`Merged ${dup._count.pledges} pledges from ${dup.id} to keeper ${keeper.id}`);
          }

          // Move any PledgeAddon references
          await tx.pledgeAddon.updateMany({
            where: { addonId: dup.id },
            data: { addonId: keeper.id },
          });

          // Delete reward items
          await tx.rewardItem.deleteMany({ where: { rewardId: dup.id } });

          // Delete the duplicate reward — deleteMany for idempotency so
          // two concurrent admin runs don't both hit P2025 on the same
          // row (the second one sees count: 0).
          const deleted = await tx.reward.deleteMany({ where: { id: dup.id } });
          totalDeleted += deleted.count;
        }
      });
    }

    cleanupLogger.info(`Cleanup complete: ${totalDeleted} duplicates deleted, ${totalMerged} pledges merged for project ${projectId}`);

    return NextResponse.json({
      success: true,
      totalDeleted,
      totalPledgesMerged: totalMerged,
    });
  } catch (error) {
    cleanupLogger.error({ err: formatError(error) }, "Cleanup error:");
    return NextResponse.json({ error: "Failed to cleanup duplicates" }, { status: 500 });
  }
}
