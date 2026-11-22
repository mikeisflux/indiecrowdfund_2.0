/**
 * Database side of upgrade (modifier) add-ons: loading a project's rewards
 * in the shape the pure helpers read, writing per-unit assignment rows, and
 * auto-assigning the forced cases. Server only — the pure logic in
 * ./modifiers is shared with the survey client.
 */

import { db } from "@/lib/db";
import {
  buildModifierQuestions,
  forcedSelections,
  type ModifierPledgeShape,
  type ModifierRewardShape,
} from "./modifiers";

/** Rewards of a project in the shape the helpers above read. */
export async function loadProjectRewardMap(projectId: string): Promise<Map<string, ModifierRewardShape>> {
  const rewards = await db.reward.findMany({
    where: { projectId },
    select: {
      id: true,
      title: true,
      type: true,
      imageUrl: true,
      shippingType: true,
      isModifier: true,
      modifiesRewardIds: true,
      sku: true,
      modifierSkuSuffix: true,
    },
  });
  return new Map(rewards.map((r: ModifierRewardShape) => [r.id, r]));
}

/**
 * Replace the assignment rows for one modifier in one pledge with `picks`
 * (index = unitIndex). Rows beyond the new quantity are removed.
 */
export async function writeAssignments(args: {
  pledgeId: string;
  modifierAddonId: string;
  picks: string[];
  source: "AUTO" | "SURVEY" | "CREATOR";
  assignedBy?: string | null;
}) {
  const { pledgeId, modifierAddonId, picks, source, assignedBy } = args;
  await db.$transaction(async (tx) => {
    await tx.pledgeModifierAssignment.deleteMany({
      where: { pledgeId, modifierAddonId, unitIndex: { gte: picks.length } },
    });
    for (let unitIndex = 0; unitIndex < picks.length; unitIndex++) {
      await tx.pledgeModifierAssignment.upsert({
        where: { pledgeId_modifierAddonId_unitIndex: { pledgeId, modifierAddonId, unitIndex } },
        create: {
          pledgeId,
          modifierAddonId,
          unitIndex,
          rewardId: picks[unitIndex],
          isAutoAssigned: source === "AUTO",
          assignedBy: assignedBy ?? null,
          source,
        },
        update: {
          rewardId: picks[unitIndex],
          isAutoAssigned: source === "AUTO",
          assignedBy: assignedBy ?? null,
          source,
        },
      });
    }
  });
}

/**
 * Write every forced answer for a pledge and report what still needs a
 * human. Safe to call repeatedly (survey load, creator "auto-assign all",
 * after a creator marks a new add-on as a modifier).
 */
export async function autoAssignPledge(
  pledge: ModifierPledgeShape,
  rewardsById: Map<string, ModifierRewardShape>,
): Promise<{ assigned: number; unresolved: number }> {
  let assigned = 0;
  let unresolved = 0;
  for (const q of buildModifierQuestions(pledge, rewardsById)) {
    const complete = q.selections.every((s) => s !== null);
    if (q.auto && !complete) {
      const forced = forcedSelections(q.targets, q.quantity)!;
      await writeAssignments({ pledgeId: pledge.id, modifierAddonId: q.modifierAddonId, picks: forced, source: "AUTO" });
      assigned++;
    } else if (q.auto && complete && q.source === null) {
      // Rows exist from a forced fill in buildModifierQuestions but were
      // never persisted (legacy single row + forced remainder).
      const forced = forcedSelections(q.targets, q.quantity)!;
      await writeAssignments({ pledgeId: pledge.id, modifierAddonId: q.modifierAddonId, picks: forced, source: "AUTO" });
      assigned++;
    } else if (!complete) {
      unresolved++;
    }
  }
  const needs = unresolved > 0;
  await db.pledge.updateMany({ where: { id: pledge.id, needsModifierAssignment: !needs }, data: { needsModifierAssignment: needs } });
  return { assigned, unresolved };
}
