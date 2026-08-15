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
import { PLATFORM_TIME_ZONE, platformTimeKey } from "@/lib/platform-time";

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

/** One bucket of the public funding curve. `cumulative` is the running total. */
export interface FundingPoint {
  /**
   * Wall-clock bucket in the platform's zone (lib/platform-time), not UTC:
   * `YYYY-MM-DD` for a daily series, `YYYY-MM-DDTHH` for the hourly one a
   * campaign gets on its launch day. Renderers print these digits as-is.
   */
  date: string;
  /** Committed in that bucket. */
  amount: number;
  /** Running total through the end of that bucket. */
  cumulative: number;
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

// ---------------------------------------------------------------------------
// Public funding curve
// ---------------------------------------------------------------------------

// Minimal shape of the raw-query surface we need. The project's Prisma client
// is loosely typed via prisma-client-stub.d.ts, so spelling this out keeps the
// function checkable without importing Prisma types (same approach as
// lib/payments/rewards.ts).
interface RawQueryable {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

interface DayRow {
  /** Already formatted YYYY-MM-DD by the query — see the note below. */
  day: string;
  total: number;
}

/**
 * Daily funding history for a project's public campaign page.
 *
 * The counting rule is the one at the top of this file, and it has to be:
 * the last point of this series is rendered directly beneath the headline
 * "raised" figure from getProjectStats(), so any divergence reads to a backer
 * as one of the two numbers being wrong. COMPLETED always; confirmed PENDING
 * as well while the project is LIVE.
 *
 * Grouped in SQL rather than by pulling pledges and bucketing in JS — a
 * campaign with thousands of backers would otherwise ship thousands of rows
 * into the request just to draw ~30 points.
 *
 * Days with no pledges are filled in with zero so the curve advances at a
 * constant rate along the x-axis; a series that skipped quiet days would
 * compress the slow middle of a campaign and overstate its momentum.
 *
 * On its first day a campaign has only one daily bucket, which is not a curve
 * — so the series falls back to hourly buckets until a second day exists.
 * Hourly points carry a `YYYY-MM-DDTHH` date; daily ones carry `YYYY-MM-DD`.
 * That length difference is the granularity marker the renderer reads, which
 * keeps this returning a plain FundingPoint[] rather than pushing a second
 * field through the project payload and both public routes.
 *
 * Returns [] when there is nothing worth drawing — the caller renders no chart
 * rather than an empty one.
 */
export async function getProjectFundingSeries(
  projectId: string,
  opts: { status: string; launchedAt?: Date | null }
): Promise<FundingPoint[]> {
  const daily = await buildFundingSeries(projectId, opts, "day");
  if (daily.length >= 2) return daily;

  // Launch day. One bucket can't show a trend, and a creator watching their
  // own launch is the likeliest person to be looking at this.
  const hourly = await buildFundingSeries(projectId, opts, "hour");
  return hourly.length >= 2 ? hourly : daily;
}

async function buildFundingSeries(
  projectId: string,
  opts: { status: string; launchedAt?: Date | null },
  granularity: "day" | "hour"
): Promise<FundingPoint[]> {
  const includePending = opts.status === "LIVE";
  const byHour = granularity === "hour";

  try {
    // Three deliberate casts:
    //   to_char  — bucket to a date string in SQL. Returning a timestamp and
    //              calling toISOString() on the driver's Date would re-project
    //              a `timestamp without time zone` through the server's local
    //              zone and slide every bucket by a day west of UTC.
    //   ::float8 — SUM over a numeric column comes back as a Decimal object;
    //              a plain number needs no marshalling on our side.
    //   ::boolean— the parameter is otherwise untyped, and Postgres won't infer
    //              a bare $n used as a boolean operand.
    const rows = await (db as unknown as RawQueryable).$queryRaw<DayRow[]>`
      SELECT to_char(
               date_trunc(
                 ${granularity}::text,
                 -- createdAt is a bare timestamp holding UTC, so it has to be
                 -- labelled UTC before it can be read in another zone.
                 -- Bucketing in UTC would break the "day" at 7pm Central and
                 -- put the evening's pledges on tomorrow's point.
                 "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${PLATFORM_TIME_ZONE}::text
               ),
               ${byHour ? 'YYYY-MM-DD"T"HH24' : "YYYY-MM-DD"}::text
             ) AS day,
             SUM("amount")::float8 AS total
      FROM "Pledge"
      WHERE "projectId" = ${projectId}
        AND "deletedAt" IS NULL
        AND (
          "status" = 'COMPLETED'
          OR (
            ${includePending}::boolean
            AND "status" = 'PENDING'
            AND "confirmationEmailSent" = true
          )
        )
      GROUP BY day
      ORDER BY day ASC
    `;

    if (!rows || rows.length === 0) return [];

    const byDay = new Map<string, number>();
    for (const r of rows) {
      byDay.set(r.day, Number(r.total) || 0);
    }

    // Bucket keys are platform-local wall-clock prefixes, so they sort and
    // compare as strings: 10 characters for a day, 13 for an hour.
    //
    // Two conversions, and they are not interchangeable. A real instant
    // (launchedAt, now) has to be shifted into the platform zone to find its
    // bucket. The loop cursor below is already a wall-clock value — fromKey
    // parsed it as UTC so the range can be stepped with date arithmetic — and
    // shifting that again would move every bucket by the offset.
    const keyLength = byHour ? 13 : 10;
    const instantToKey = (d: Date) => platformTimeKey(d, granularity);
    const cursorToKey = (d: Date) => d.toISOString().slice(0, keyLength);
    const fromKey = (k: string) =>
      new Date(byHour ? `${k}:00:00Z` : `${k}T00:00:00Z`);

    const keys = Array.from(byDay.keys()).sort();
    // Start at launch when we know it, so the curve opens on day one rather
    // than on the first day money happened to come in.
    const firstKey = keys[0];
    const launchKey = opts.launchedAt ? instantToKey(new Date(opts.launchedAt)) : firstKey;
    const start = fromKey(launchKey < firstKey ? launchKey : firstKey);

    // End at the last bucket with money, or now for a running campaign.
    const lastKey = keys[keys.length - 1];
    const nowKey = instantToKey(new Date());
    const endKey = opts.status === "LIVE" && nowKey > lastKey ? nowKey : lastKey;
    const end = fromKey(endKey);

    // Guard against a bad launchedAt (or clock skew) producing an unbounded
    // loop: a campaign can't sensibly chart more than a few years of days.
    const MAX_DAYS = 1000;

    const series: FundingPoint[] = [];
    let cumulative = 0;
    for (
      let d = new Date(start);
      d <= end && series.length < MAX_DAYS;
      byHour ? d.setUTCHours(d.getUTCHours() + 1) : d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const key = cursorToKey(d);
      const amount = byDay.get(key) ?? 0;
      cumulative += amount;
      series.push({
        date: key,
        amount: Math.round(amount * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100,
      });
    }

    return series;
  } catch (error) {
    // A missing curve is a missing decoration, not a broken campaign page.
    statsLogger.error(
      { err: error instanceof Error ? error.message : String(error), projectId },
      "Failed to build funding series"
    );
    return [];
  }
}
