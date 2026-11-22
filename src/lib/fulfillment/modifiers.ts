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
 *   - how to validate / write the picks as PledgeModifierAssignment rows.
 *
 * Pure (safe in client bundles); the db helpers live in ./modifiers-db.
 * Nothing in here is specific to a campaign: eligibility comes from Reward.modifiesRewardIds
 * and shipping type, quantities from the pledge, names from the rewards.
 */

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
}

export interface ModifierPledgeShape {
  id: string;
  rewardId: string | null;
  addons: { addonId: string; quantity: number }[];
  modifierAssignments?: { id?: string; rewardId: string; modifierAddonId: string; unitIndex?: number | null; source?: string | null }[];
}

/** One thing in the pledge an upgrade could be applied to. */
export interface EligibleTarget {
  rewardId: string;
  title: string;
  imageUrl: string | null;
  /** How many copies of this item the backer holds (tier = 1, add-on = its quantity). */
  quantity: number;
  /** Whether this is the pledge's tier or one of its add-ons. */
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
  /** rewardId per unit (index = unitIndex); null = not chosen yet. */
  selections: (string | null)[];
  /** True when there is exactly one way to apply it, so nothing is asked. */
  auto: boolean;
  /** Where the current rows came from, when they exist. */
  source: "AUTO" | "SURVEY" | "CREATOR" | null;
}

/**
 * Items in the pledge this modifier can apply to.
 *
 * modifiesRewardIds narrows the set when the creator filled it in. Empty
 * means "anything physical in this order": the tier plus every add-on that
 * ships and is not itself a modifier. Digital items can't be foil.
 */
export function eligibleTargets(
  modifier: ModifierRewardShape,
  pledge: ModifierPledgeShape,
  rewardsById: Map<string, ModifierRewardShape>,
): EligibleTarget[] {
  const allow = new Set((modifier.modifiesRewardIds || []).filter(Boolean));
  const narrowed = allow.size > 0;
  const out: EligibleTarget[] = [];

  const consider = (rewardId: string, quantity: number, kind: "tier" | "addon") => {
    if (rewardId === modifier.id) return;
    const reward = rewardsById.get(rewardId);
    if (!reward) return;
    if (reward.isModifier) return;
    if (narrowed) {
      if (!allow.has(rewardId)) return;
    } else if (reward.shippingType === "NO_SHIPPING") {
      return;
    }
    if (quantity <= 0) return;
    out.push({ rewardId, title: reward.title, imageUrl: reward.imageUrl ?? null, quantity, kind });
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
 * Returns the rewardId for each unit, or null when a real choice exists.
 */
export function forcedSelections(targets: EligibleTarget[], quantity: number): string[] | null {
  const total = targets.reduce((s, t) => s + t.quantity, 0);
  if (total === 0 || total !== quantity) return null;
  const out: string[] = [];
  for (const t of targets) for (let i = 0; i < t.quantity; i++) out.push(t.rewardId);
  return out;
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
      // narrowed modifiesRewardIds after the backer answered).
      if (i >= 0 && i < quantity && targets.some((t) => t.rewardId === r.rewardId)) selections[i] = r.rewardId;
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
    const target = question.targets.find((t) => t.rewardId === p);
    if (!target) return `"${question.title}" can't be applied to that item`;
    const n = (used.get(target.rewardId) ?? 0) + 1;
    if (n > target.quantity) {
      return `You only have ${target.quantity} of "${target.title}" — "${question.title}" was applied to it ${n} times`;
    }
    used.set(target.rewardId, n);
  }
  return null;
}

/**
 * Best guess at what a free-text answer meant, for campaigns that asked
 * "which cover do you want upgraded?" as an open question before this
 * existed. Matches the digits / codes in the text against the eligible
 * targets' titles and SKUs ("Sw3 12, 18 & 24" → SW3-12, SW3-18, SW3-24;
 * "05" → SW3-05). Returns up to `quantity` rewardIds; the creator confirms.
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
  const scored: { rewardId: string; score: number; order: number }[] = [];
  targets.forEach((t, order) => {
    const titles = [t.title, rewardsById?.get(t.rewardId)?.sku || ""].filter(Boolean).map((s) => s.toLowerCase());
    let score = 0;
    for (const title of titles) {
      if (lower.includes(title)) score = Math.max(score, 3);
      const codes = title.replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
      // "SW3-18" → the numeric part "18" is what people type.
      for (const code of codes) {
        const num = code.replace(/^[a-z]+\d*-?/, "").replace(/^0+(\d)/, "$1");
        if (/^\d+$/.test(num) && tokens.has(num)) score = Math.max(score, 2);
        if (tokens.has(code)) score = Math.max(score, 2);
      }
    }
    if (score > 0) scored.push({ rewardId: t.rewardId, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  const out: string[] = [];
  for (const s of scored) {
    const t = targets.find((x) => x.rewardId === s.rewardId)!;
    const already = out.filter((r) => r === s.rewardId).length;
    if (already < t.quantity) out.push(s.rewardId);
    if (out.length >= quantity) break;
  }
  return out;
}
