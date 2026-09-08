import { db } from "@/lib/db";
import { getProjectStats } from "@/lib/stats";
import { unlockThreshold, type UnlockAmount } from "@/lib/rewards/unlock";

/**
 * Stretch goals: campaign milestones that attach themselves to backers' orders.
 *
 * A stretch goal is a Reward with type STRETCH_GOAL, a threshold in
 * `unlockAtAmount`, and amount 0. Nobody buys one — once the campaign's raised
 * total reaches the threshold, it is granted to every qualifying pledge as a
 * PledgeAddon at $0, which is the row the survey, the fulfillment views and
 * the pledge summary already read. That reuse is the point: a stretch goal
 * shows up everywhere an add-on does without a second code path.
 *
 * Idempotent by construction. PledgeAddon is unique on (pledgeId, addonId), so
 * `skipDuplicates` makes re-running this a no-op — which matters because it
 * has to run repeatedly: backers who pledge AFTER a goal unlocks must receive
 * it too, and that can only be caught by looking again.
 */

/** Pledge states that earn a stretch goal. */
const QUALIFYING_STATUSES = ["COMPLETED", "PENDING"] as const;

export interface StretchGoalDistribution {
  projectId: string;
  raisedAmount: number;
  /** Goals whose threshold the campaign has reached. */
  unlockedGoalIds: string[];
  /** PledgeAddon rows actually written this run. */
  granted: number;
  /** Rows taken back off pledges that stopped qualifying. */
  revoked: number;
}

/**
 * Grant every unlocked stretch goal on one project to every qualifying pledge.
 *
 * Qualifying = not deleted, COMPLETED or PENDING, and holding a PHYSICAL
 * reward tier.
 *
 * PENDING is included because an all-or-nothing campaign parks real backers
 * there until the goal is hit — they helped reach the stretch goal and would
 * be the odd ones out.
 *
 * Two exclusions, both for the same reason — there is no box to put the thing
 * in, and granting it would invent a fulfillment obligation the backer never
 * opted into:
 *
 *   - Pledges with no reward at all.
 *   - Pledges on a DIGITAL tier (shippingType NO_SHIPPING). A backer who
 *     bought a PDF has no shipment for a physical milestone item to ride
 *     along in, and the creator would owe them postage on a $15 digital
 *     pledge. Note this cannot be delegated to the usual digital gate, which
 *     compares the ADD-ON's shippingType: a stretch goal is always
 *     NO_SHIPPING (it never charges its own postage), so that check would
 *     wave every one of them through.
 *
 * The consequence, stated plainly: a stretch goal that is itself digital —
 * a bonus wallpaper, an extra PDF — also skips digital backers, because
 * nothing on the row distinguishes it from a physical one. Giving creators
 * that choice needs a flag on the reward; until then this errs toward not
 * promising a digital backer something the creator would have to ship.
 */
const PHYSICAL_SHIPPING_TYPES = ["WORLDWIDE", "SELECTED_COUNTRIES"] as const;
export async function distributeStretchGoalsForProject(
  projectId: string
): Promise<StretchGoalDistribution> {
  const goals = await db.reward.findMany({
    where: { projectId, type: "STRETCH_GOAL", isEnded: false },
    select: { id: true, unlockAtAmount: true },
  });

  const empty: StretchGoalDistribution = {
    projectId,
    raisedAmount: 0,
    unlockedGoalIds: [],
    granted: 0,
    revoked: 0,
  };
  if (goals.length === 0) {
    return { ...empty, revoked: await revokeIneligibleStretchGoals(projectId) };
  }

  // Live stats rather than Project.currentAmount: that column lags, and a
  // creator watching the meter cross a milestone expects it to fire.
  const stats = await getProjectStats(projectId);
  const raisedAmount = stats.currentAmount;

  const unlocked = goals.filter((g) => {
    const threshold = unlockThreshold(g.unlockAtAmount);
    return threshold !== null && raisedAmount >= threshold;
  });
  if (unlocked.length === 0) {
    return {
      ...empty,
      raisedAmount,
      revoked: await revokeIneligibleStretchGoals(projectId),
    };
  }

  const pledges = await db.pledge.findMany({
    where: {
      projectId,
      deletedAt: null,
      status: { in: [...QUALIFYING_STATUSES] as ("COMPLETED")[] },
      NOT: { rewardId: null },
      // Listed positively rather than as `not: "NO_SHIPPING"` — Prisma 7 is
      // fussy about `not` on this shape, and naming the physical types makes
      // a future shipping type opt in on purpose instead of by accident.
      reward: {
        shippingType: { in: [...PHYSICAL_SHIPPING_TYPES] as ("WORLDWIDE")[] },
      },
    },
    select: { id: true },
  });
  if (pledges.length === 0) {
    return {
      ...empty,
      raisedAmount,
      unlockedGoalIds: unlocked.map((g) => g.id),
      revoked: await revokeIneligibleStretchGoals(projectId),
    };
  }

  const rows = pledges.flatMap((p) =>
    unlocked.map((g) => ({
      pledgeId: p.id,
      addonId: g.id,
      quantity: 1,
      // Free. The backer already paid for this by getting the campaign here.
      amount: 0,
    }))
  );

  const result = await db.pledgeAddon.createMany({
    data: rows,
    skipDuplicates: true,
  });

  const revoked = await revokeIneligibleStretchGoals(projectId);

  return {
    projectId,
    raisedAmount,
    unlockedGoalIds: unlocked.map((g) => g.id),
    granted: result.count,
    revoked,
  };
}

/**
 * Take stretch goals back off pledges that no longer qualify for them.
 *
 * Granting is not a one-way door. A pledge can stop qualifying long after it
 * was granted, and every route below leaves a stretch goal sitting in an order
 * that should not have one:
 *
 *   - The backer edits their pledge and swaps a physical tier for a digital
 *     one. Nothing about the granted row changes on its own, so the creator
 *     would be shipping a milestone item to someone who bought a PDF.
 *   - The pledge is refunded, cancelled or charged back. The money went back;
 *     the goods should not go out.
 *   - The pledge drops its reward entirely, or is soft-deleted.
 *
 * Written as a sweep over the whole project rather than as a hook on each of
 * those events on purpose. There are several refund paths (admin, webhook,
 * RefundRequest) and more than one way to edit an order; a sweep that states
 * the eligibility rule once cannot be bypassed by a path nobody remembered to
 * update. The modify route calls it directly so the change is immediate, and
 * the cron catches everything else within a cycle.
 *
 * Only STRETCH_GOAL rows are touched. A real add-on the backer paid for is
 * never removed by this, whatever state the pledge is in.
 */
export async function revokeIneligibleStretchGoals(projectId: string): Promise<number> {
  const result = await db.pledgeAddon.deleteMany({
    where: {
      addon: { projectId, type: "STRETCH_GOAL" },
      pledge: {
        OR: [
          // Refunded, cancelled, charged back or failed.
          { status: { notIn: [...QUALIFYING_STATUSES] as ("COMPLETED")[] } },
          // Switched to a digital tier — no shipment to ride along in.
          { reward: { shippingType: "NO_SHIPPING" } },
          // Dropped the reward, or the pledge was soft-deleted.
          { rewardId: null },
          // `NOT: { field: null }` rather than `{ not: null }` — Prisma 7
          // rejects the latter at runtime on nullable columns.
          { NOT: { deletedAt: null } },
        ],
      },
    },
  });
  return result.count;
}

/**
 * Bring one pledge's stretch goals in line with what it now qualifies for.
 *
 * Called straight after an order is modified so the backer sees the right
 * contents immediately rather than after the next cron cycle.
 */
export async function reconcileStretchGoalsForPledge(pledgeId: string): Promise<void> {
  const pledge = await db.pledge.findUnique({
    where: { id: pledgeId },
    select: { projectId: true },
  });
  if (!pledge) return;
  await distributeStretchGoalsForProject(pledge.projectId);
}

/**
 * Which of a project's stretch goals are unlocked, for display.
 *
 * Returned sorted by threshold so the milestone bar can lay them out left to
 * right without re-sorting at every call site.
 */
export function summarizeStretchGoals<
  T extends { id: string; unlockAtAmount: UnlockAmount }
>(goals: T[], raisedAmount: number): (T & { threshold: number; unlocked: boolean })[] {
  return goals
    .map((g) => ({ ...g, threshold: unlockThreshold(g.unlockAtAmount) ?? 0 }))
    .filter((g) => g.threshold > 0)
    .sort((a, b) => a.threshold - b.threshold)
    .map((g) => ({ ...g, unlocked: raisedAmount >= g.threshold }));
}
