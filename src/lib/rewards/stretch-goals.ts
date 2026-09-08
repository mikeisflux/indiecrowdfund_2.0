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
}

/**
 * Grant every unlocked stretch goal on one project to every qualifying pledge.
 *
 * Qualifying = not deleted, COMPLETED or PENDING, and holding a reward tier.
 * PENDING is included because an all-or-nothing campaign parks real backers
 * there until the goal is hit — they helped reach the stretch goal and would
 * be the odd ones out. Pledges with no reward are excluded: there is no order
 * to attach a physical milestone item to, and granting one would invent a
 * fulfillment obligation the backer never opted into.
 */
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
  };
  if (goals.length === 0) return empty;

  // Live stats rather than Project.currentAmount: that column lags, and a
  // creator watching the meter cross a milestone expects it to fire.
  const stats = await getProjectStats(projectId);
  const raisedAmount = stats.currentAmount;

  const unlocked = goals.filter((g) => {
    const threshold = unlockThreshold(g.unlockAtAmount);
    return threshold !== null && raisedAmount >= threshold;
  });
  if (unlocked.length === 0) return { ...empty, raisedAmount };

  const pledges = await db.pledge.findMany({
    where: {
      projectId,
      deletedAt: null,
      status: { in: [...QUALIFYING_STATUSES] as ("COMPLETED")[] },
      NOT: { rewardId: null },
    },
    select: { id: true },
  });
  if (pledges.length === 0) {
    return { ...empty, raisedAmount, unlockedGoalIds: unlocked.map((g) => g.id) };
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

  return {
    projectId,
    raisedAmount,
    unlockedGoalIds: unlocked.map((g) => g.id),
    granted: result.count,
  };
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
