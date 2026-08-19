/**
 * Per-pledge bookkeeping for DivinityCoin off-session charge retries.
 *
 * Stripe caches the first result for an idempotency key for 24 hours, declines
 * included, so "which key does the next attempt use" is not a detail — it
 * decides whether the retry reaches the bank at all. The answer depends on how
 * the *previous* attempt ended, which means it has to be remembered between
 * cron ticks. It lives in `pledge.metadata.dcCharge`:
 *
 *   { attemptKey?: "attempt-2", uncertainSince?: "<ISO>" }
 *
 * Metadata rather than columns because it is transient scaffolding — it exists
 * only while a charge is mid-retry and is cleared the moment one settles.
 * Nothing queries or reports on it, so there is nothing to index.
 *
 * The two transitions that matter:
 *
 *   markDeclined  — definitive answer. Advance the key so the next attempt is
 *                   a genuine new authorization instead of a replayed 402.
 *   markUncertain — no answer. Hold the key exactly as it is, so a retry
 *                   inside 24h dedupes against the attempt that may have
 *                   landed, and flag the pledge so the next tick asks
 *                   lookup-payment before charging again.
 */

export interface DcChargeAttemptState {
  /**
   * Idempotency key for the NEXT charge on this pledge. Undefined means send
   * none, which is the correct first attempt — DC then keys on pledgeId alone.
   */
  attemptKey?: string;
  /**
   * Set when an attempt ended without a verdict (timeout, socket error). While
   * this is set the money may or may not have moved, so the next attempt must
   * confirm via lookup-payment before charging.
   */
  uncertainSince?: string;
}

type Meta = Record<string, unknown>;

const asObject = (value: unknown): Meta =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Meta)
    : {};

export function readDcChargeState(metadata: unknown): DcChargeAttemptState {
  const bucket = asObject(asObject(metadata).dcCharge);
  return {
    attemptKey: typeof bucket.attemptKey === "string" ? bucket.attemptKey : undefined,
    uncertainSince:
      typeof bucket.uncertainSince === "string" ? bucket.uncertainSince : undefined,
  };
}

/**
 * The key that follows `current`. The initial attempt carries no key, so the
 * first retry is "attempt-2" — matching DC's documented example rather than
 * starting a second numbering scheme at 1.
 */
export function nextAttemptKey(current?: string): string {
  const parsed = Number(/^attempt-(\d+)$/.exec(current ?? "")?.[1]);
  return `attempt-${Number.isFinite(parsed) && parsed >= 1 ? parsed + 1 : 2}`;
}

/**
 * Merge a new charge state into a pledge's metadata, preserving every other
 * key. Pass null to clear the bucket once the charge has settled.
 *
 * Returns a plain object for `pledge.update({ data: { metadata } })`. Prisma's
 * Json input rejects `undefined` inside the value, so absent fields are
 * omitted rather than set to undefined.
 */
export function withDcChargeState(
  metadata: unknown,
  next: DcChargeAttemptState | null
): Meta {
  const base = { ...asObject(metadata) };
  if (!next || (!next.attemptKey && !next.uncertainSince)) {
    delete base.dcCharge;
    return base;
  }
  const bucket: Meta = {};
  if (next.attemptKey) bucket.attemptKey = next.attemptKey;
  if (next.uncertainSince) bucket.uncertainSince = next.uncertainSince;
  base.dcCharge = bucket;
  return base;
}
