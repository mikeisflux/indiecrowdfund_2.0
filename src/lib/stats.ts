/**
 * Centralized stats service.
 *
 * All pledge aggregation, backer counts, and platform totals live here.
 * API routes should call these functions instead of doing raw DB queries.
 *
 * Counting rules (applied consistently everywhere):
 *   - COMPLETED pledges are always counted.
 *   - For LIVE projects, confirmed PENDING pledges are also counted.
 *     "Confirmed" means confirmationEmailSent = true (Stripe / PayPal /
 *     Whop / DC paths set this on commit). These represent backers who
 *     completed checkout with a deferred charge.
 *
 *     The PENDING widening is NOT gated on currentAmount < goalAmount.
 *     AoN campaigns don't transition PENDING -> COMPLETED until the
 *     funded-cron fires at campaign end, so a LIVE AoN at 300% of goal
 *     still has committed-but-unconverted pledges that are real backers
 *     and must show in the public total. Gating on currentAmount <
 *     goalAmount made the public total DROP once the COMPLETED slice
 *     alone crossed the goal.
 *
 *   - Platform-wide totals (totalRaised, etc.) count COMPLETED pledges only.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const statsLogger = logger.child({ module: "stats" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectStats {
  currentAmount: number;
  backerCount: number;
  goalAmount: number;
  fundingPercentage: number;
  status: string;
}

export interface SyncResult {
  updated: boolean;
  previousAmount: number;
  previousBackerCount: number;
  currentAmount: number;
  backerCount: number;
}

export interface BatchProjectStats {
  currentAmount: number;
  backerCount: number;
}

export interface PlatformTotals {
  totalRaised: number;
  totalBackers: number;
  totalPledges: number;
  projectsFunded: number;
  projectsLive: number;
  projectsTotal: number;
  totalCreators: number;
  totalUsers: number;
  categoryCounts: { category: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Core calculation helpers
// ---------------------------------------------------------------------------

/**
 * Calculate live funding stats for a single project.
 * Pass `projectMeta` to avoid an extra DB round-trip if you already have it.
 */
export async function getProjectStats(
  projectId: string,
  projectMeta?: { status: string; goalAmount: number | string | { toNumber(): number } }
): Promise<ProjectStats> {
  let resolved = projectMeta;

  if (!resolved) {
    const row = await db.project.findFirst({
      where: { id: projectId , deletedAt: null },
      select: { status: true, goalAmount: true },
    });
    if (!row) throw new Error(`Project not found: ${projectId}`);
    resolved = row;
  }

  const meta = resolved as NonNullable<typeof resolved>;
  const goalAmount = Number(meta.goalAmount);

  const completed = await db.pledge.aggregate({
    where: { projectId, status: "COMPLETED", deletedAt: null },
    _sum: { amount: true },
    _count: { id: true },
  });

  let currentAmount = Number(completed._sum.amount ?? 0);
  let backerCount = completed._count.id ?? 0;

  if (meta.status === "LIVE") {
    const pending = await db.pledge.aggregate({
      where: {
        projectId,
        status: "PENDING",
        deletedAt: null,
        // Stripe / PayPal / Whop / DC mark confirmationEmailSent on
        // commit. The vaulted card is the commitment marker because
        // the funded-cron will charge it at success.
        confirmationEmailSent: true,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    currentAmount += Number(pending._sum.amount ?? 0);
    backerCount += pending._count.id ?? 0;
  }

  return {
    currentAmount,
    backerCount,
    goalAmount,
    fundingPercentage: goalAmount > 0 ? (currentAmount / goalAmount) * 100 : 0,
    status: meta.status,
  };
}

/**
 * Calculate live funding stats for multiple projects in 2 batch queries.
 * Returns a Map keyed by project ID.
 */
export async function getBatchProjectStats(
  projects: Array<{ id: string; status: string; goalAmount: number | string | { toNumber(): number } }>
): Promise<Map<string, BatchProjectStats>> {
  if (projects.length === 0) return new Map();

  const projectIds = projects.map((p) => p.id);

  const completedTotals = await db.pledge.groupBy({
    by: ["projectId"],
    where: { projectId: { in: projectIds }, status: "COMPLETED", deletedAt: null },
    _sum: { amount: true },
    _count: { id: true },
  });

  const completedMap = new Map(completedTotals.map((t) => [t.projectId, t]));

  // Fetch committed-PENDING for every LIVE project (no goal-met
  // gate — see the file-level comment for why). AoN campaigns at
  // 300% of goal still have unconverted PENDING vault pledges that
  // are real committed backers and must show in the public total.
  const liveIds = projects
    .filter((p) => p.status === "LIVE")
    .map((p) => p.id);

  const pendingMap = new Map<string, { _sum: { amount: unknown }; _count: { id: number } }>();

  if (liveIds.length > 0) {
    const pendingTotals = await db.pledge.groupBy({
      by: ["projectId"],
      where: {
        projectId: { in: liveIds },
        status: "PENDING",
        deletedAt: null,
        confirmationEmailSent: true,
      },
      _sum: { amount: true },
      _count: { id: true },
    });
    for (const t of pendingTotals) pendingMap.set(t.projectId, t);
  }

  const result = new Map<string, BatchProjectStats>();
  for (const project of projects) {
    const completedAmount = Number(completedMap.get(project.id)?._sum.amount ?? 0);
    const pendingAmount = Number(pendingMap.get(project.id)?._sum.amount ?? 0);
    const completedBackers = completedMap.get(project.id)?._count.id ?? 0;
    const pendingBackers = pendingMap.get(project.id)?._count.id ?? 0;

    result.set(project.id, {
      currentAmount: completedAmount + pendingAmount,
      backerCount: completedBackers + pendingBackers,
    });
  }

  return result;
}

/**
 * Recalculate a project's stats and write them back to the DB if they differ.
 */
export async function syncProjectStats(projectId: string): Promise<SyncResult> {
  const project = await db.project.findFirst({
    where: { id: projectId , deletedAt: null },
    select: { id: true, currentAmount: true, backerCount: true, goalAmount: true, status: true },
  });

  if (!project) throw new Error(`Project not found: ${projectId}`);

  const fresh = await getProjectStats(projectId, {
    status: project.status,
    goalAmount: project.goalAmount,
  });

  const previousAmount = Number(project.currentAmount);
  const previousBackerCount = project.backerCount;

  if (previousAmount === fresh.currentAmount && previousBackerCount === fresh.backerCount) {
    return {
      updated: false,
      previousAmount,
      previousBackerCount,
      currentAmount: fresh.currentAmount,
      backerCount: fresh.backerCount,
    };
  }

  await db.project.update({
    where: { id: projectId },
    data: { currentAmount: fresh.currentAmount, backerCount: fresh.backerCount },
  });

  statsLogger.info(
    `[Sync] Project ${projectId}: $${previousAmount} → $${fresh.currentAmount}, ${previousBackerCount} → ${fresh.backerCount} backers`
  );

  return {
    updated: true,
    previousAmount,
    previousBackerCount,
    currentAmount: fresh.currentAmount,
    backerCount: fresh.backerCount,
  };
}

/**
 * Batch sync stats for all LIVE, FUNDED, and FAILED projects.
 */
export async function syncAllProjectStats(): Promise<{
  updated: number;
  total: number;
  changes: { title: string; oldAmount: number; newAmount: number; oldBackers: number; newBackers: number }[];
}> {
  const projects = await db.project.findMany({
    where: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
    select: { id: true, currentAmount: true, backerCount: true, goalAmount: true, status: true, title: true },
  });

  const statsMap = await getBatchProjectStats(projects);

  let updated = 0;
  const changes: { title: string; oldAmount: number; newAmount: number; oldBackers: number; newBackers: number }[] = [];

  for (const project of projects) {
    const fresh = statsMap.get(project.id);
    if (!fresh) continue;

    const oldAmount = Number(project.currentAmount);
    const oldBackers = project.backerCount;

    if (oldAmount !== fresh.currentAmount || oldBackers !== fresh.backerCount) {
      await db.project.update({
        where: { id: project.id },
        data: { currentAmount: fresh.currentAmount, backerCount: fresh.backerCount },
      });
      updated++;
      changes.push({
        title: project.title,
        oldAmount,
        newAmount: fresh.currentAmount,
        oldBackers,
        newBackers: fresh.backerCount,
      });
    }
  }

  statsLogger.info(`[Batch Sync] Updated ${updated}/${projects.length} projects`);

  return { updated, total: projects.length, changes };
}

/**
 * Platform-wide totals used on the homepage banner and platform-stats API.
 * Counts COMPLETED pledges only (no committed pending) for authoritative totals.
 */
export async function getPlatformTotals(): Promise<PlatformTotals> {
  const completedFilter = {
    deletedAt: null,
    status: "COMPLETED" as const,
    project: { status: { in: ["LIVE", "FUNDED", "FAILED"] as const }, deletedAt: null },
  };

  const [
    fundedProjectsCount,
    liveProjectsCount,
    totalProjectsCount,
    completedPledgeTotal,
    totalBackers,
    totalPledges,
    totalCreators,
    totalUsers,
    categoryCounts,
  ] = await Promise.all([
    db.project.count({ where: { status: "FUNDED", deletedAt: null } }),
    db.project.count({ where: { status: "LIVE", deletedAt: null } }),
    db.project.count({ where: { status: { not: "DRAFT" }, deletedAt: null } }),
    db.pledge.aggregate({ where: completedFilter, _sum: { amount: true } }),
    db.pledge.groupBy({ by: ["userId"], where: completedFilter }),
    db.pledge.count({ where: completedFilter }),
    db.project.groupBy({ by: ["creatorId"], where: { status: { not: "DRAFT" }, deletedAt: null } }),
    db.user.count({ where: { deletedAt: null } }),
    db.project.groupBy({
      by: ["category"],
      _count: { id: true },
      where: { status: { in: ["LIVE", "FUNDED"] }, deletedAt: null },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);

  return {
    totalRaised: Number(completedPledgeTotal._sum.amount ?? 0),
    totalBackers: totalBackers.length,
    totalPledges,
    projectsFunded: fundedProjectsCount,
    projectsLive: liveProjectsCount,
    projectsTotal: totalProjectsCount,
    totalCreators: totalCreators.length,
    totalUsers,
    categoryCounts: categoryCounts.map((c) => ({ category: c.category, count: c._count.id })),
  };
}
