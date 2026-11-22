/**
 * Database side of upgrade (modifier) add-ons: loading a project's rewards,
 * items and SKU mappings in the shape the pure helpers read, writing
 * per-unit assignment rows, auto-assigning the forced cases, and creating
 * the upgraded edition items. Server only — the pure logic in ./modifiers
 * and ./production-counts is shared with the survey client.
 */

import { db } from "@/lib/db";
import {
  buildModifierQuestions,
  forcedSelections,
  parseTargetKey,
  type ModifierPledgeShape,
  type ModifierRewardShape,
} from "./modifiers";
import { comboSku, resolvePledgeLines, type SkuContext } from "./production-counts";

/** Rewards of a project, with their item breakdown, keyed by id. */
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
      items: {
        select: {
          projectItemId: true,
          title: true,
          imageUrl: true,
          projectItem: { select: { title: true, sku: true, imageUrl: true } },
        },
      },
    },
  });
  type Row = Omit<ModifierRewardShape, "items"> & {
    items: { projectItemId: string | null; title: string; imageUrl: string | null; projectItem: { title: string; sku: string | null; imageUrl: string | null } | null }[];
  };
  return new Map(
    (rewards as Row[]).map((r) => [
      r.id,
      {
        ...r,
        items: r.items.map((i) => ({
          projectItemId: i.projectItemId,
          title: i.projectItem?.title || i.title,
          sku: i.projectItem?.sku ?? null,
          imageUrl: i.projectItem?.imageUrl ?? i.imageUrl ?? null,
        })),
      },
    ]),
  );
}

/** Everything SKU resolution needs for a project. */
export async function loadSkuContext(projectId: string): Promise<SkuContext> {
  const [rewardsById, projectItems, skuMappings, modifierSkuMappings] = await Promise.all([
    loadProjectRewardMap(projectId),
    db.projectItem.findMany({
      where: { projectId },
      select: { id: true, title: true, sku: true, inStock: true, upgradeOfItemId: true, upgradeModifierId: true },
    }),
    db.shopifySkuMapping.findMany({
      where: { projectId },
      select: { sourceType: true, sourceId: true, shopifySku: true, shopifyVariantId: true, quantity: true },
    }),
    db.modifierSkuMapping.findMany({
      where: { projectId },
      select: { baseRewardId: true, modifierAddonId: true, shopifySku: true, shopifyVariantId: true },
    }),
  ]);
  return {
    rewardsById,
    projectItemsById: new Map(projectItems.map((i: { id: string }) => [i.id, i])),
    skuMappings,
    modifierSkuMappings,
  };
}

/**
 * Replace the assignment rows for one modifier in one pledge with `picks`
 * (target keys; index = unitIndex). Rows beyond the new quantity are removed.
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
      const { rewardId, projectItemId } = parseTargetKey(picks[unitIndex]);
      await tx.pledgeModifierAssignment.upsert({
        where: { pledgeId_modifierAddonId_unitIndex: { pledgeId, modifierAddonId, unitIndex } },
        create: {
          pledgeId,
          modifierAddonId,
          unitIndex,
          rewardId,
          projectItemId,
          isAutoAssigned: source === "AUTO",
          assignedBy: assignedBy ?? null,
          source,
        },
        update: {
          rewardId,
          projectItemId,
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
    if (q.auto && (!complete || q.source === null)) {
      // Forced, and either unanswered or only present as a legacy fill:
      // persist it so counts, push and the backer's survey agree.
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

const ASSIGNMENT_PLEDGE_SELECT = {
  id: true,
  rewardId: true,
  addons: { select: { addonId: true, quantity: true } },
  modifierAssignments: { select: { id: true, rewardId: true, projectItemId: true, modifierAddonId: true, unitIndex: true, source: true } },
} as const;

/**
 * Make sure every (item, upgrade) combination that any backer has been
 * assigned exists as a ProjectItem of its own ("SW3-22" + "Upgrade to
 * foil" → "SW3-22-F"), so the production order can list it and track its
 * stock like any other item. Idempotent; returns how many were created.
 * Pass a context to skip the reload when the caller already has one.
 */
export async function ensureUpgradeVariantItems(projectId: string, preloaded?: SkuContext): Promise<{ created: number; ctx: SkuContext }> {
  let ctx = preloaded ?? (await loadSkuContext(projectId));
  const pledges = (await db.pledge.findMany({
    where: { projectId, deletedAt: null, status: "COMPLETED", modifierAssignments: { some: {} } },
    select: ASSIGNMENT_PLEDGE_SELECT,
  })) as ModifierPledgeShape[];

  const wanted = new Map<string, { baseProjectItemId: string; modifierAddonId: string; sku: string }>();
  for (const pledge of pledges) {
    for (const line of resolvePledgeLines(pledge, ctx)) {
      if (line.kind !== "upgrade" || !line.baseProjectItemId || !line.modifierAddonId || line.projectItemId || !line.sku) continue;
      wanted.set(`${line.baseProjectItemId}+${line.modifierAddonId}`, { baseProjectItemId: line.baseProjectItemId, modifierAddonId: line.modifierAddonId, sku: line.sku });
    }
  }
  if (wanted.size === 0) return { created: 0, ctx };

  let created = 0;
  for (const w of wanted.values()) {
    const existing = await db.projectItem.findFirst({
      where: { projectId, upgradeOfItemId: w.baseProjectItemId, upgradeModifierId: w.modifierAddonId },
      select: { id: true },
    });
    if (existing) continue;
    const base = ctx.projectItemsById.get(w.baseProjectItemId);
    const modifier = ctx.rewardsById.get(w.modifierAddonId);
    await db.projectItem.create({
      data: {
        projectId,
        title: w.sku,
        sku: w.sku,
        description: `${base?.title || "Item"} with ${modifier?.title || "upgrade"} applied`,
        upgradeOfItemId: w.baseProjectItemId,
        upgradeModifierId: w.modifierAddonId,
      },
    });
    created++;
  }
  if (created > 0) ctx = await loadSkuContext(projectId);
  return { created, ctx };
}

/** The SKU an upgraded unit would get, for display before/without a variant item. */
export function upgradedSku(baseRewardId: string, baseProjectItemId: string | null, modifierAddonId: string, ctx: SkuContext): string | null {
  return comboSku(baseRewardId, baseProjectItemId, modifierAddonId, ctx).sku;
}
