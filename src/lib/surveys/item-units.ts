/**
 * Per-unit survey answers for items bought in quantity.
 *
 * A backer who added "Art Print of Your Choice" x10 was asked which print
 * they wanted exactly once, so the survey could only ever record ten copies
 * of one print. Item questions are keyed by SurveyItemQuestion id; when the
 * backer holds more than one of that reward, each unit gets its own answers.
 *
 * Storage stays backward compatible: unit 1 lives under the plain item id
 * (every existing response and every creator-side reader keeps working), and
 * units 2..N live under `<itemQuestionId>#2`, `#3`, …
 */

export interface ItemResponse {
  variants?: Record<string, string>;
  customAnswers?: Record<string, string | string[]>;
}

export type ItemResponses = Record<string, ItemResponse>;

const SEP = "#";

/** Key for a 0-based unit of an item. Unit 0 is the item id itself. */
export function unitKey(itemQuestionId: string, unit: number): string {
  return unit <= 0 ? itemQuestionId : `${itemQuestionId}${SEP}${unit + 1}`;
}

/** Inverse of unitKey. Unknown shapes are treated as unit 0 of that key. */
export function parseUnitKey(key: string): { itemQuestionId: string; unit: number } {
  const i = key.lastIndexOf(SEP);
  if (i <= 0) return { itemQuestionId: key, unit: 0 };
  const n = Number(key.slice(i + 1));
  if (!Number.isInteger(n) || n < 2) return { itemQuestionId: key, unit: 0 };
  return { itemQuestionId: key.slice(0, i), unit: n - 1 };
}

/** How many of this reward the pledge holds: 1 for the tier, the add-on quantity otherwise. */
export function itemQuantity(
  rewardId: string,
  pledge: { rewardId: string | null; addons: { addonId: string; quantity?: number | null }[] }
): number {
  if (pledge.rewardId === rewardId) return 1;
  const addon = pledge.addons.find((a) => a.addonId === rewardId);
  if (!addon) return 1;
  return Math.max(1, Math.min(addon.quantity ?? 1, 100));
}

/** "Art Print (#3 of 10)" when there is more than one, plain name otherwise. */
export function unitLabel(itemName: string, unit: number, quantity: number): string {
  return quantity > 1 ? `${itemName} (#${unit + 1} of ${quantity})` : itemName;
}

/**
 * Every saved unit of an item, in order, for creator-side readers that don't
 * know the quantity: unit 0 under the item id, then any `#n` keys present.
 */
export function listItemUnits(
  itemResponses: ItemResponses | null | undefined,
  itemQuestionId: string
): { unit: number; key: string; response: ItemResponse }[] {
  if (!itemResponses) return [];
  const out: { unit: number; key: string; response: ItemResponse }[] = [];
  for (const [key, response] of Object.entries(itemResponses)) {
    const parsed = parseUnitKey(key);
    if (parsed.itemQuestionId !== itemQuestionId) continue;
    out.push({ unit: parsed.unit, key, response });
  }
  return out.sort((a, b) => a.unit - b.unit);
}

/** Join one question's answers across units for a single export cell. */
export function joinUnitAnswers(values: (string | string[] | undefined)[]): string {
  const parts = values.map((v) => (Array.isArray(v) ? v.join("; ") : v || ""));
  if (parts.length <= 1) return parts[0] || "";
  return parts.map((p, i) => `#${i + 1}: ${p || "—"}`).join(" | ");
}
