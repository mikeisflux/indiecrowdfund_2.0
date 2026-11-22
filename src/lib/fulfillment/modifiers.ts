/**
 * Upgrade ("modifier") add-ons, resolved per unit.
 *
 * A modifier add-on changes something the backer already holds instead of
 * being a thing of its own: "Upgrade to foil" turns one of their covers into
 * the foil edition. What production needs is WHICH cover, per copy of the
 * upgrade. This module is the one place that knows:
 *
 *   - which items in a pledge a given modifier may apply to (eligibility),
 *   - how many copies of each the backer holds (units),
 *   - when the answer is forced (one possible target → auto-assign),
 *   - what to ask the backer otherwise (one pick per unit), and
 *   - how to validate the picks (the db writes live in ./modifiers-db).
 *
 * A target is an ITEM inside a reward, not just the reward: a bundle tier
 * ("The Rebel Box") holds several ProjectItems and the backer upgrades one
 * of them. A reward with no item breakdown is its own single target.
 * Targets are addressed by `key` = "<rewardId>|<projectItemId or empty>".
 *
 * Pure (safe in client bundles). Nothing in here is specific to a campaign:
 * eligibility comes from Reward.modifiesRewardIds (reward ids or project
 * item ids) and shipping type, quantities from the pledge, names from the
 * rewards and their items.
 */

export interface ModifierRewardItemShape {
  projectItemId: string | null;
  title: string;
  sku?: string | null;
  imageUrl?: string | null;
}

export interface ModifierRewardShape {
  id: string;
  title: string;
  type: string;
  imageUrl?: string | null;
  shippingType?: string | null;
  isModifier?: boolean | null;
  modifiesRewardIds?: string[] | null;
  sku?: string | null;
  modifierSkuSuffix?: string | null;
  /** The reward's item breakdown (RewardItem rows). Empty = the reward is the item. */
  items?: ModifierRewardItemShape[];
}

export interface ModifierAssignmentShape {
  id?: string;
  rewardId: string;
  projectItemId?: string | null;
  modifierAddonId: string;
  unitIndex?: number | null;
  source?: string | null;
}

export interface ModifierPledgeShape {
  id: string;
  rewardId: string | null;
  addons: { addonId: string; quantity: number }[];
  modifierAssignments?: ModifierAssignmentShape[];
}

/** One thing in the pledge an upgrade could be applied to. */
export interface EligibleTarget {
  /** "<rewardId>|<projectItemId or empty>" — what picks and assignment rows store. */
  key: string;
  rewardId: string;
  projectItemId: string | null;
  title: string;
  imageUrl: string | null;
  /** How many copies of this item the backer holds (reward units × times the item appears in it). */
  quantity: number;
  /** Whether the reward it came from is the pledge's tier or one of its add-ons. */
  kind: "tier" | "addon";
}

/** What the survey asks (or confirms) for one modifier add-on in a pledge. */
export interface ModifierQuestion {
  modifierAddonId: string;
  title: string;
  imageUrl: string | null;
  /** Copies of the upgrade the backer bought; one pick per copy. */
  quantity: number;
  targets: EligibleTarget[];
  /** Target key per unit (index = unitIndex); null = not chosen yet. */
  selections: (string | null)[];
  /** True when there is exactly one way to apply it, so nothing is asked. */
  auto: boolean;
  /** Where the current rows came from, when they exist. */
  source: "AUTO" | "SURVEY" | "CREATOR" | null;
}

export function targetKey(rewardId: string, projectItemId: string | null | undefined): string {
  return `${rewardId}|${projectItemId ?? ""}`;
}

export function parseTargetKey(key: string): { rewardId: string; projectItemId: string | null } {
  const i = key.indexOf("|");
  if (i < 0) return { rewardId: key, projectItemId: null };
  return { rewardId: key.slice(0, i), projectItemId: key.slice(i + 1) || null };
}

/**
 * The physical units a reward contributes, per item. A reward with an item
 * breakdown yields one entry per distinct ProjectItem (an item listed twice
 * counts twice); a reward without one yields itself. Items with no
 * ProjectItem link (title-only RewardItem rows) are folded into the reward
 * itself, since nothing else can address them.
 */
export function rewardUnits(reward: ModifierRewardShape): { projectItemId: string | null; title: string; imageUrl: string | null; perReward: number }[] {
  const linked = (reward.items || []).filter((i) => i.projectItemId);
  if (linked.length === 0) return [{ projectItemId: null, title: reward.title, imageUrl: reward.imageUrl ?? null, perReward: 1 }];
  const by = new Map<string, { projectItemId: string | null; title: string; imageUrl: string | null; perReward: number }>();
  for (const i of linked) {
    const cur = by.get(i.projectItemId!);
    if (cur) cur.perReward++;
    else by.set(i.projectItemId!, { projectItemId: i.projectItemId, title: i.title, imageUrl: i.imageUrl ?? reward.imageUrl ?? null, perReward: 1 });
  }
  return Array.from(by.values());
}

/**
 * Items in the pledge this modifier can apply to.
 *
 * modifiesRewardIds narrows the set when the creator filled it in; it may
 * hold reward ids (every item of that reward) or project item ids (that item
 * wherever it appears). Empty means "anything physical in this order":
 * every item of the tier and of each add-on that ships and is not itself a
 * modifier. Digital items can't be foil.
 */
export function eligibleTargets(
  modifier: ModifierRewardShape,
  pledge: ModifierPledgeShape,
  rewardsById: Map<string, ModifierRewardShape>,
): EligibleTarget[] {
  const allow = new Set((modifier.modifiesRewardIds || []).filter(Boolean));
  const narrowed = allow.size > 0;
  const out: EligibleTarget[] = [];

  const consider = (rewardId: string, rewardQty: number, kind: "tier" | "addon") => {
    if (rewardId === modifier.id || rewardQty <= 0) return;
    const reward = rewardsById.get(rewardId);
    if (!reward || reward.isModifier) return;
    if (!narrowed && reward.shippingType === "NO_SHIPPING") return;
    const units = rewardUnits(reward);
    const multi = units.length > 1;
    for (const u of units) {
      if (narrowed && !allow.has(rewardId) && !(u.projectItemId && allow.has(u.projectItemId))) continue;
      const key = targetKey(rewardId, u.projectItemId);
      const existing = out.find((t) => t.key === key);
      const quantity = rewardQty * u.perReward;
      if (existing) {
        existing.quantity += quantity;
        continue;
      }
      out.push({
        key,
        rewardId,
        projectItemId: u.projectItemId,
        title: multi ? `${u.title} (from ${reward.title})` : u.projectItemId && u.title !== reward.title ? `${reward.title} — ${u.title}` : reward.title,
        imageUrl: u.imageUrl,
        quantity,
        kind,
      });
    }
  };

  if (pledge.rewardId) consider(pledge.rewardId, 1, "tier");
  for (const a of pledge.addons) consider(a.addonId, Math.max(0, a.quantity ?? 1), "addon");
  return out;
}

/** Modifier add-ons in the pledge, with how many copies of each. */
export function pledgeModifiers(
  pledge: ModifierPledgeShape,
  rewardsById: Map<string, ModifierRewardShape>,
): { modifier: ModifierRewardShape; quantity: number }[] {
  const out: { modifier: ModifierRewardShape; quantity: number }[] = [];
  for (const a of pledge.addons) {
    const r = rewardsById.get(a.addonId);
    if (r?.isModifier && (a.quantity ?? 1) > 0) out.push({ modifier: r, quantity: Math.max(1, a.quantity ?? 1) });
  }
  return out;
}

/**
 * The forced answer, if there is one: every eligible unit gets upgraded
 * when the backer holds exactly as many eligible copies as upgrades (one
 * cover + one foil upgrade; four add-on covers + four foil upgrades).
 * Returns the target key for each unit, or null when a real choice exists.
 */
export function forcedSelections(targets: EligibleTarget[], quantity: number): string[] | null {
  const total = targets.reduce((s, t) => s + t.quantity, 0);
  if (total === 0 || total !== quantity) return null;
  const out: string[] = [];
  for (const t of targets) for (let i = 0; i < t.quantity; i++) out.push(t.key);
  return out;
}

/**
 * The target an assignment row points at. A row written before item-level
 * targeting (projectItemId null) on a reward that has items means that
 * reward's first eligible item, which is exact for single-item rewards and
 * the only sane reading for the rest.
 */
export function rowTargetKey(row: Pick<ModifierAssignmentShape, "rewardId" | "projectItemId">, targets: EligibleTarget[]): string | null {
  const exact = targetKey(row.rewardId, row.projectItemId ?? null);
  if (targets.some((t) => t.key === exact)) return exact;
  if (!row.projectItemId) {
    const first = targets.find((t) => t.rewardId === row.rewardId);
    if (first) return first.key;
  }
  return null;
}

/** Build the survey's view of every modifier in a pledge. */
export function buildModifierQuestions(
  pledge: ModifierPledgeShape,
  rewardsById: Map<string, ModifierRewardShape>,
): ModifierQuestion[] {
  const rows = pledge.modifierAssignments || [];
  return pledgeModifiers(pledge, rewardsById).map(({ modifier, quantity }) => {
    const targets = eligibleTargets(modifier, pledge, rewardsById);
    const forced = forcedSelections(targets, quantity);
    const mine = rows
      .filter((r) => r.modifierAddonId === modifier.id)
      .sort((a, b) => (a.unitIndex ?? 0) - (b.unitIndex ?? 0));
    const selections: (string | null)[] = Array.from({ length: quantity }, () => null);
    for (const r of mine) {
      const i = r.unitIndex ?? 0;
      // Only keep picks that are still valid targets (a creator may have
      // narrowed the eligible items after the backer answered).
      if (i >= 0 && i < quantity) selections[i] = rowTargetKey(r, targets);
    }
    // Old single-row assignments (pre-unit schema) covered one copy only;
    // if the rest is forced anyway, fill it in.
    if (forced && selections.some((s) => s === null)) {
      for (let i = 0; i < quantity; i++) if (selections[i] === null) selections[i] = forced[i];
    }
    const source = (mine.find((r) => r.source)?.source as ModifierQuestion["source"]) ?? (mine.length ? "CREATOR" : null);
    return {
      modifierAddonId: modifier.id,
      title: modifier.title,
      imageUrl: modifier.imageUrl ?? null,
      quantity,
      targets,
      selections,
      auto: forced !== null,
      source,
    };
  });
}

/**
 * Check a backer's / creator's picks for one modifier. Every unit must be
 * chosen, every pick must be an eligible target, and no target may be
 * picked more times than the backer holds copies of it.
 */
export function validateSelections(
  question: Pick<ModifierQuestion, "title" | "quantity" | "targets">,
  picks: (string | null | undefined)[],
): string | null {
  if (picks.length < question.quantity || picks.slice(0, question.quantity).some((p) => !p)) {
    return question.quantity > 1
      ? `Please choose which item each "${question.title}" applies to (${question.quantity} needed)`
      : `Please choose which item "${question.title}" applies to`;
  }
  const used = new Map<string, number>();
  for (const p of picks.slice(0, question.quantity)) {
    const target = question.targets.find((t) => t.key === p);
    if (!target) return `"${question.title}" can't be applied to that item`;
    const n = (used.get(target.key) ?? 0) + 1;
    if (n > target.quantity) {
      return `You only have ${target.quantity} of "${target.title}" — "${question.title}" was applied to it ${n} times`;
    }
    used.set(target.key, n);
  }
  return null;
}

/**
 * Best guess at what a free-text answer meant, for campaigns that asked
 * "which cover do you want upgraded?" as an open question before this
 * existed. Matches the digits / codes in the text against the eligible
 * targets' titles and SKUs ("Sw3 12, 18 & 24" → SW3-12, SW3-18, SW3-24;
 * "05" → SW3-05). Returns up to `quantity` target keys; the creator confirms.
 */
export function suggestFromText(
  text: string | null | undefined,
  targets: EligibleTarget[],
  quantity: number,
  rewardsById?: Map<string, ModifierRewardShape>,
): string[] {
  if (!text || targets.length === 0) return [];
  const lower = text.toLowerCase();
  const tokens = new Set(
    lower
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((t) => t.replace(/^0+(\d)/, "$1")),
  );
  const scored: { key: string; score: number; order: number }[] = [];
  targets.forEach((t, order) => {
    const reward = rewardsById?.get(t.rewardId);
    const item = reward?.items?.find((i) => i.projectItemId === t.projectItemId);
    const names = [t.title, item?.sku || "", item?.title || "", reward?.sku || ""].filter(Boolean).map((s) => s.toLowerCase());
    let score = 0;
    for (const name of names) {
      if (lower.includes(name)) score = Math.max(score, 3);
      const codes = name.replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
      // "SW3-18" → the numeric part "18" is what people type.
      for (const code of codes) {
        const num = code.replace(/^[a-z]+\d*-?/, "").replace(/^0+(\d)/, "$1");
        if (/^\d+$/.test(num) && tokens.has(num)) score = Math.max(score, 2);
        if (tokens.has(code)) score = Math.max(score, 2);
      }
    }
    if (score > 0) scored.push({ key: t.key, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  const out: string[] = [];
  for (const s of scored) {
    const t = targets.find((x) => x.key === s.key)!;
    const already = out.filter((k) => k === s.key).length;
    if (already < t.quantity) out.push(s.key);
    if (out.length >= quantity) break;
  }
  return out;
}
