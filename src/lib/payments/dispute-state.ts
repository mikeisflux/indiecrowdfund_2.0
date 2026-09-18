/**
 * What we remember about a dispute, and how long there is to answer it.
 *
 * A dispute has a clock. Stripe gives roughly three weeks to submit evidence
 * and the processor's payload carries the exact deadline in `evidenceDueBy`;
 * miss it and the dispute is lost by default, whatever the merits. Until now
 * we dropped that field, so the only way to learn a dispute existed — let alone
 * when it was due — was to open the processor's dashboard and notice. A pair of
 * disputes reached nine days old that way.
 *
 * Kept in `pledge.metadata.dispute` rather than in columns. The pledge already
 * records the outcome in `status: CHARGEBACK`; this is the paperwork around it,
 * it is read by exactly one admin view, and nothing filters or sorts on it in
 * SQL. A JSON bucket needs no migration against the live database, which is the
 * deciding factor for a field whose whole purpose is to be shown to one person.
 */

export interface DisputeState {
  /** The processor's dispute id, for looking it up on their side. */
  disputeId?: string;
  /** Which processor reported it. */
  processor?: string;
  /** Their stated reason: "fraudulent", "credit_not_processed", … */
  reason?: string;
  /** Their dispute status: "warning_needs_response", "won", "lost", … */
  status?: string;
  /** ISO deadline for submitting evidence. The part that matters. */
  evidenceDueBy?: string;
  /** When we recorded it, so a missing evidenceDueBy still dates the dispute. */
  openedAt?: string;
}

type Meta = Record<string, unknown>;

const asObject = (value: unknown): Meta =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Meta)
    : {};

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

export function readDisputeState(metadata: unknown): DisputeState | null {
  const bucket = asObject(metadata).dispute;
  if (typeof bucket !== "object" || bucket === null || Array.isArray(bucket)) {
    return null;
  }
  const b = bucket as Meta;
  const state: DisputeState = {
    disputeId: str(b.disputeId),
    processor: str(b.processor),
    reason: str(b.reason),
    status: str(b.status),
    evidenceDueBy: str(b.evidenceDueBy),
    openedAt: str(b.openedAt),
  };
  return Object.values(state).some((v) => v !== undefined) ? state : null;
}

/**
 * Merge dispute details into a pledge's metadata, preserving every other key.
 *
 * Returns a plain object for `pledge.update({ data: { metadata } })`. Prisma's
 * Json input rejects `undefined` inside the value, so absent fields are omitted
 * rather than written as undefined.
 */
export function withDisputeState(metadata: unknown, next: DisputeState): Meta {
  const base = { ...asObject(metadata) };
  const existing = readDisputeState(metadata) ?? {};
  const merged: DisputeState = { ...existing, ...stripUndefined(next) };

  const bucket: Meta = {};
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) bucket[key] = value;
  }

  if (Object.keys(bucket).length === 0) {
    delete base.dispute;
    return base;
  }
  base.dispute = bucket;
  return base;
}

function stripUndefined(state: DisputeState): DisputeState {
  const out: DisputeState = {};
  for (const [key, value] of Object.entries(state)) {
    if (value !== undefined) out[key as keyof DisputeState] = value as string;
  }
  return out;
}

/** Whole days until evidence is due. Negative once the deadline has passed. */
export function daysUntilEvidenceDue(
  evidenceDueBy: string | undefined,
  now: Date = new Date()
): number | null {
  if (!evidenceDueBy) return null;
  const due = new Date(evidenceDueBy);
  if (Number.isNaN(due.getTime())) return null;
  // Ceil so "due in six hours" reads as 1 day left rather than 0. Rounding a
  // live deadline down to zero would make it look already lost.
  return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
}

export type DisputeUrgency = "overdue" | "critical" | "soon" | "open";

/**
 * How loudly to shout about a deadline. `critical` is three days or fewer,
 * which is about the point where gathering shipping records and correspondence
 * stops being comfortable.
 */
export function disputeUrgency(daysLeft: number | null): DisputeUrgency {
  if (daysLeft === null) return "open";
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 3) return "critical";
  if (daysLeft <= 7) return "soon";
  return "open";
}
