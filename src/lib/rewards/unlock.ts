/**
 * Goal-locked rewards.
 *
 * A locked reward is listed from the start of the campaign and cannot be
 * pledged until the campaign's raised total reaches `unlockAtAmount`. That
 * visibility is the whole feature: a backer is meant to see the thing they are
 * pushing toward, which is why this is not modelled as a SECRET reward
 * (hidden until you have the link) or an ended one (gone).
 *
 * The comparison is `>=`, so a campaign sitting exactly on the number is
 * unlocked. A backer watching the total tick past the figure printed on the
 * card and finding it still locked would read as a bug, whatever the docs say.
 */

export type UnlockAmount = number | string | { toString(): string } | null | undefined;

/** Decimal columns arrive as strings or Prisma Decimals; null means unlocked. */
export function unlockThreshold(value: UnlockAmount): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value.toString());
  // A non-positive or unparseable threshold is meaningless — treat it as no
  // lock rather than as a reward nobody can ever buy.
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** True when this reward is not yet purchasable at the campaign's total. */
export function isRewardLocked(value: UnlockAmount, raisedAmount: number): boolean {
  const threshold = unlockThreshold(value);
  if (threshold === null) return false;
  return raisedAmount < threshold;
}

/** How much more the campaign needs before this reward opens. */
export function amountUntilUnlock(value: UnlockAmount, raisedAmount: number): number {
  const threshold = unlockThreshold(value);
  if (threshold === null) return 0;
  return Math.max(0, threshold - raisedAmount);
}

/**
 * "Unlocks at $5,000" — the label that has to appear next to the stamp.
 *
 * Whole dollars unless the threshold genuinely has cents. A creator typing
 * 5000 should not get "$5,000.00" shouted across a reward card.
 */
export function formatUnlockAmount(value: UnlockAmount, currency = "USD"): string {
  const threshold = unlockThreshold(value);
  if (threshold === null) return "";
  const hasCents = Math.round(threshold * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(threshold);
}
