/**
 * What has to be made, by SKU, from the orders as they stand.
 *
 * Production counts used to be "backers per tier" plus "add-on items sold",
 * which goes wrong the moment an upgrade add-on is involved: a backer with
 * SW3-18 and "Upgrade to foil" is one SW3-18-F and zero SW3-18, but the old
 * numbers counted one SW3-18 and one upgrade. This module turns every
 * pledge into the physical units it owes (resolvePledgeLines), with
 * upgrades applied to the item each copy was assigned to, and totals them
 * across the campaign (computeProductionCounts) split into what is
 * confirmed by a finished survey and what could still change.
 *
 * SKUs come from, in order: a ShopifySkuMapping row for the item, then
 * Reward.sku. Upgraded items use a ModifierSkuMapping row for the exact
 * combination, else base SKU + the modifier's suffix. The same resolution
 * feeds the Shopify push, so the draft order and the counts can't disagree.
 */

import type { ModifierRewardShape, ModifierPledgeShape } from "./modifiers";
import { pledgeModifiers } from "./modifiers";

export interface SkuMappingShape {
  sourceType: string;
  sourceId: string;
  shopifySku: string;
  shopifyVariantId?: string | null;
  quantity?: number | null;
}

export interface ModifierSkuMappingShape {
  baseRewardId: string;
  modifierAddonId: string;
  shopifySku: string;
  shopifyVariantId?: string | null;
}

export interface SkuContext {
  rewardsById: Map<string, ModifierRewardShape>;
  skuMappings: SkuMappingShape[];
  modifierSkuMappings: ModifierSkuMappingShape[];
}

export type LineKind = "tier" | "addon" | "upgrade" | "unassigned_upgrade";

export interface PledgeLine {
  /** Stable grouping key: rewardId, "rewardId+modifierId", or "unassigned:modifierId". */
  key: string;
  kind: LineKind;
  rewardId: string;
  modifierAddonId: string | null;
  /** "SW3-18", "SW3-18 + Upgrade to foil", "Upgrade to foil (not yet assigned)". */
  label: string;
  sku: string | null;
  /** True when the SKU was derived from base SKU + suffix rather than mapped. */
  skuDerived: boolean;
  shopifyVariantId: string | null;
  /** Physical copies of this line in the pledge. */
  quantity: number;
  /** From the SKU mapping: 1 item = N of this SKU (defaults to 1). */
  unitsPerItem: number;
}

function baseSku(rewardId: string, ctx: SkuContext): { sku: string | null; variantId: string | null; unitsPerItem: number } {
  const reward = ctx.rewardsById.get(rewardId);
  const mapping = ctx.skuMappings.find(
    (m) => (m.sourceType === "REWARD" || m.sourceType === "ADDON") && m.sourceId === rewardId,
  );
  if (mapping) {
    return { sku: mapping.shopifySku, variantId: mapping.shopifyVariantId ?? null, unitsPerItem: Math.max(1, mapping.quantity ?? 1) };
  }
  return { sku: reward?.sku?.trim() || null, variantId: null, unitsPerItem: 1 };
}

const SUFFIX_STOPWORDS = new Set(["to", "the", "a", "an", "of", "in", "with", "and", "edition", "version", "cover", "upgrade", "upgraded"]);

/**
 * A SKU suffix implied by an upgrade's name, for when the creator hasn't set
 * one: "Upgrade to foil" → "-F", "Upgrade to Raised Metal" → "-RM",
 * "Glow in the dark" → "-GD". Initials of the meaningful words. Null when
 * nothing is left ("Upgrade").
 */
export function defaultModifierSuffix(title: string | null | undefined): string | null {
  if (!title) return null;
  const words = title
    .replace(/\(.*?\)/g, " ")
    .split(/[^A-Za-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w && !SUFFIX_STOPWORDS.has(w.toLowerCase()));
  if (words.length === 0) return null;
  return "-" + words.map((w) => w[0].toUpperCase()).join("");
}

/** The suffix an upgrade actually uses: the creator's, else the derived default. */
export function effectiveModifierSuffix(modifier: Pick<ModifierRewardShape, "title" | "modifierSkuSuffix"> | undefined): string | null {
  if (!modifier) return null;
  return modifier.modifierSkuSuffix?.trim() || defaultModifierSuffix(modifier.title);
}

/** SKU for an item with a modifier applied. */
export function comboSku(
  baseRewardId: string,
  modifierAddonId: string,
  ctx: SkuContext,
): { sku: string | null; variantId: string | null; derived: boolean } {
  const mapped = ctx.modifierSkuMappings.find((m) => m.baseRewardId === baseRewardId && m.modifierAddonId === modifierAddonId);
  if (mapped) return { sku: mapped.shopifySku, variantId: mapped.shopifyVariantId ?? null, derived: false };
  const base = baseSku(baseRewardId, ctx);
  const suffix = effectiveModifierSuffix(ctx.rewardsById.get(modifierAddonId));
  if (base.sku && suffix) return { sku: `${base.sku}${suffix}`, variantId: null, derived: true };
  return { sku: null, variantId: null, derived: true };
}

export function itemLabel(rewardId: string, ctx: SkuContext): string {
  const reward = ctx.rewardsById.get(rewardId);
  return reward?.title || "Unknown item";
}

/**
 * The physical units one pledge owes, upgrades applied. Modifier add-ons
 * never appear as their own line: each assigned copy moves one unit of its
 * target from the base line to the upgraded line, and copies that nobody
 * has assigned yet are reported as "unassigned_upgrade" so the creator can
 * see what is still unknown.
 */
export function resolvePledgeLines(pledge: ModifierPledgeShape, ctx: SkuContext): PledgeLine[] {
  const { rewardsById } = ctx;
  const units = new Map<string, number>();
  const order: string[] = [];
  const add = (rewardId: string, qty: number) => {
    const reward = rewardsById.get(rewardId);
    if (!reward || reward.isModifier || qty <= 0) return;
    if (!units.has(rewardId)) order.push(rewardId);
    units.set(rewardId, (units.get(rewardId) ?? 0) + qty);
  };
  if (pledge.rewardId) add(pledge.rewardId, 1);
  for (const a of pledge.addons) add(a.addonId, Math.max(0, a.quantity ?? 1));

  const upgrades = new Map<string, number>(); // "rewardId+modifierId" -> count
  const unassigned: { modifierAddonId: string; count: number }[] = [];
  const rows = (pledge.modifierAssignments || []).slice().sort((a, b) => (a.unitIndex ?? 0) - (b.unitIndex ?? 0));

  for (const { modifier, quantity } of pledgeModifiers(pledge, rewardsById)) {
    let applied = 0;
    for (const row of rows) {
      if (row.modifierAddonId !== modifier.id) continue;
      if (applied >= quantity) break;
      const left = units.get(row.rewardId) ?? 0;
      if (left <= 0) continue; // target no longer in the order, or over-assigned
      units.set(row.rewardId, left - 1);
      const key = `${row.rewardId}+${modifier.id}`;
      upgrades.set(key, (upgrades.get(key) ?? 0) + 1);
      applied++;
    }
    if (applied < quantity) unassigned.push({ modifierAddonId: modifier.id, count: quantity - applied });
  }

  const lines: PledgeLine[] = [];
  for (const rewardId of order) {
    const qty = units.get(rewardId) ?? 0;
    if (qty > 0) {
      const base = baseSku(rewardId, ctx);
      const reward = rewardsById.get(rewardId)!;
      lines.push({
        key: rewardId,
        kind: pledge.rewardId === rewardId ? "tier" : "addon",
        rewardId,
        modifierAddonId: null,
        label: reward.title,
        sku: base.sku,
        skuDerived: false,
        shopifyVariantId: base.variantId,
        quantity: qty,
        unitsPerItem: base.unitsPerItem,
      });
    }
    for (const [key, count] of upgrades) {
      if (!key.startsWith(`${rewardId}+`)) continue;
      const modifierAddonId = key.slice(rewardId.length + 1);
      const combo = comboSku(rewardId, modifierAddonId, ctx);
      lines.push({
        key,
        kind: "upgrade",
        rewardId,
        modifierAddonId,
        label: `${itemLabel(rewardId, ctx)} + ${itemLabel(modifierAddonId, ctx)}`,
        sku: combo.sku,
        skuDerived: combo.derived,
        shopifyVariantId: combo.variantId,
        quantity: count,
        unitsPerItem: 1,
      });
    }
  }
  for (const u of unassigned) {
    lines.push({
      key: `unassigned:${u.modifierAddonId}`,
      kind: "unassigned_upgrade",
      rewardId: u.modifierAddonId,
      modifierAddonId: u.modifierAddonId,
      label: `${itemLabel(u.modifierAddonId, ctx)} (not yet assigned)`,
      sku: null,
      skuDerived: false,
      shopifyVariantId: null,
      quantity: u.count,
      unitsPerItem: 1,
    });
  }
  return lines;
}

export interface ProductionLine {
  /** "sku:<SKU>" when the line has a SKU (tier and add-on copies of one product merge), else the per-reward key. */
  key: string;
  kind: LineKind;
  rewardId: string;
  modifierAddonId: string | null;
  label: string;
  /** Every reward title that fed this line ("SW3-01", "SW3-01 (Add-on)"). */
  titles: string[];
  sku: string | null;
  skuDerived: boolean;
  /** Units from pledges whose survey is complete (or that have nothing to answer). */
  confirmed: number;
  /** Units from pledges still waiting on a survey; the base item could still be upgraded. */
  pending: number;
  total: number;
  backers: number;
}

export interface ProductionPledgeInput extends ModifierPledgeShape {
  /** Survey finished (by backer or creator) or order locked. */
  surveyComplete: boolean;
}

/**
 * Totals across the campaign, one line per SKU. A cover sold as a tier and
 * again as an add-on is one product to print, so lines with the same SKU
 * merge ("SW3-01" + "SW3-01 (Add-on)" → SW3-01); so do upgraded copies
 * from either source (→ SW3-01-F). Lines without a SKU stay per reward.
 * Sorted: base items, then upgrades, then unassigned.
 */
export function computeProductionCounts(pledges: ProductionPledgeInput[], ctx: SkuContext): ProductionLine[] {
  const byKey = new Map<string, ProductionLine & { backerIds: Set<string>; titleSet: Set<string> }>();
  for (const pledge of pledges) {
    for (const line of resolvePledgeLines(pledge, ctx)) {
      const key = line.sku && line.kind !== "unassigned_upgrade" ? `sku:${line.sku.toUpperCase()}` : line.key;
      let agg = byKey.get(key);
      if (!agg) {
        agg = {
          key,
          kind: line.kind,
          rewardId: line.rewardId,
          modifierAddonId: line.modifierAddonId,
          label: line.label,
          titles: [],
          sku: line.sku,
          skuDerived: line.skuDerived,
          confirmed: 0,
          pending: 0,
          total: 0,
          backers: 0,
          backerIds: new Set<string>(),
          titleSet: new Set<string>(),
        };
        byKey.set(key, agg);
      }
      // A merged line is "tier" if any of its sources is the tier.
      if (line.kind === "tier" && agg.kind === "addon") agg.kind = "tier";
      agg.titleSet.add(line.label);
      const units = line.quantity * line.unitsPerItem;
      if (pledge.surveyComplete) agg.confirmed += units;
      else agg.pending += units;
      agg.total += units;
      agg.backerIds.add(pledge.id);
    }
  }
  const rank: Record<LineKind, number> = { tier: 0, addon: 0, upgrade: 1, unassigned_upgrade: 2 };
  return Array.from(byKey.values())
    .map(({ backerIds, titleSet, ...line }) => {
      const titles = Array.from(titleSet);
      // Merged base lines read as the SKU; an upgrade line keeps
      // "<item> + <upgrade>" with the item named once.
      const label =
        titles.length === 1
          ? titles[0]
          : line.modifierAddonId
            ? `${baseSku(line.rewardId, ctx).sku ?? titles[0].split(" + ")[0]} + ${itemLabel(line.modifierAddonId, ctx)}`
            : line.sku ?? titles[0];
      return { ...line, label, titles, backers: backerIds.size };
    })
    .sort((a, b) => rank[a.kind] - rank[b.kind] || (a.sku || a.label).localeCompare(b.sku || b.label, undefined, { numeric: true }));
}

/**
 * Per-option counts for survey item questions (shirt sizes, print choices):
 * every variant and every single/multi-select custom question, one line per
 * chosen option, from completed responses only. `unanswered` is how many
 * units are held by backers who haven't finished their survey.
 */
export interface VariantLine {
  key: string;
  itemQuestionId: string;
  rewardId: string;
  itemName: string;
  question: string;
  option: string;
  sku: string | null;
  count: number;
}

export interface VariantQuestionShape {
  id: string;
  rewardId: string;
  itemName: string;
  variants: { id: string; variantType: string; options: string[]; skuPrefix?: string | null }[];
  customQuestions: { id: string; question: string; questionType: string; options: string[] }[];
}

type ItemResponseMap = Record<string, { variants?: Record<string, string>; customAnswers?: Record<string, string | string[]> }>;

export function computeVariantCounts(
  itemQuestions: VariantQuestionShape[],
  pledges: (ProductionPledgeInput & { itemResponses?: unknown })[],
  ctx: SkuContext,
): { lines: VariantLine[]; unanswered: { itemQuestionId: string; itemName: string; units: number }[] } {
  const lines = new Map<string, VariantLine>();
  const unanswered = new Map<string, { itemQuestionId: string; itemName: string; units: number }>();
  const slug = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");

  for (const iq of itemQuestions) {
    const askable = iq.variants.length > 0 || iq.customQuestions.some((q) => q.questionType !== "OPEN_TEXT");
    if (!askable) continue;
    const base = baseSku(iq.rewardId, ctx).sku;
    for (const pledge of pledges) {
      const held = pledge.rewardId === iq.rewardId ? 1 : pledge.addons.find((a) => a.addonId === iq.rewardId)?.quantity ?? 0;
      if (held <= 0) continue;
      const responses = (pledge.itemResponses || {}) as ItemResponseMap;
      if (!pledge.surveyComplete) {
        const u = unanswered.get(iq.id) ?? { itemQuestionId: iq.id, itemName: iq.itemName, units: 0 };
        u.units += held;
        unanswered.set(iq.id, u);
        continue;
      }
      for (let unit = 0; unit < held; unit++) {
        const resp = responses[unit === 0 ? iq.id : `${iq.id}#${unit + 1}`];
        if (!resp) continue;
        const bump = (questionLabel: string, option: string, skuHint: string | null) => {
          const key = `${iq.id}|${questionLabel}|${option}`;
          const line = lines.get(key) ?? {
            key,
            itemQuestionId: iq.id,
            rewardId: iq.rewardId,
            itemName: iq.itemName,
            question: questionLabel,
            option,
            sku: skuHint,
            count: 0,
          };
          line.count++;
          lines.set(key, line);
        };
        for (const v of iq.variants) {
          const val = resp.variants?.[v.id] ?? resp.variants?.[v.variantType];
          if (val) bump(v.variantType, val, base ? `${v.skuPrefix || base}-${slug(val)}` : null);
        }
        for (const q of iq.customQuestions) {
          if (q.questionType === "OPEN_TEXT") continue;
          const a = resp.customAnswers?.[q.id];
          const vals = Array.isArray(a) ? a : a ? [a] : [];
          for (const val of vals) bump(q.question, val, base ? `${base}-${slug(val)}` : null);
        }
      }
    }
  }
  return {
    lines: Array.from(lines.values()).sort((a, b) => a.itemName.localeCompare(b.itemName) || a.question.localeCompare(b.question) || b.count - a.count),
    unanswered: Array.from(unanswered.values()),
  };
}

export function productionCsv(lines: ProductionLine[]): string {
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [["SKU", "Item", "Type", "Confirmed", "Pending survey", "Total", "Backers"]];
  for (const l of lines) {
    rows.push([l.sku ?? "", l.label, l.kind.replace("_", " "), l.confirmed, l.pending, l.total, l.backers].map(esc));
  }
  return rows.map((r) => r.join(",")).join("\n");
}

/**
 * A product code already sitting in an item's title: "SW3-18 (Add-on)" →
 * "SW3-18"; "Lady Darth #1 CLEAN LD1-01" → "LD1-01"; "SW1-9-SW2-26" (a
 * two-cover pack) → "SW1-9-SW2-26"; "Challenge Coin" → null. Used to fill
 * blank Reward.sku fields for creators who name items by code.
 */
export function guessSkuFromTitle(title: string): string | null {
  const cleaned = title.replace(/\((add-?on|addon)\)/i, "").trim();
  const codes = cleaned.match(/\b[A-Z]{1,6}\d{0,3}-[A-Z0-9]{1,8}(?:-[A-Z0-9]{1,8}){0,3}\b/g);
  if (!codes || codes.length === 0) return null;
  // Prefer a code that is the whole title; otherwise the last code mentioned.
  const whole = codes.find((c) => c === cleaned);
  return whole ?? codes[codes.length - 1];
}
