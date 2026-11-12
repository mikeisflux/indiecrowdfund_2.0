import { db } from "@/lib/db";
import { callDivinityCoinAPI } from "./client";
import { paymentsDivinitycoinLogger as log } from "./config";
import { alertAdmins } from "@/lib/admin-alerts";

/**
 * The one door every DivinityCoin refund goes through.
 *
 * DC's refund endpoint takes no idempotency key, so a request that got a
 * 500 or timed out may or may not have refunded the card, and sending it
 * again can pay the same money out twice. Six places in the app used to
 * call that endpoint directly with no record of what they had sent. Now
 * every attempt is written to DcRefundAttempt before the call and settled
 * after it, and the table is consulted first:
 *
 *  - an attempt on the same payment that is still in flight, or that never
 *    got a clear answer (UNCERTAIN), blocks a new one until an admin has
 *    looked at the payment in DC and passes `force`;
 *  - a refund with the same `idempotencyKey` that already SUCCEEDED is
 *    returned as-is instead of being sent again (a retried cancel, a
 *    double-clicked button, a cron tick overlapping another);
 *  - the amount is capped at what was charged minus what our records show
 *    already refunded, when the charged amount is known.
 *
 * DC still enforces its own cap; this stops us from asking twice.
 */

export type DcRefundRequester = "admin" | "creator" | "user" | "system";

export interface DcRefundRequest {
  paymentId: string;
  pledgeId: string | null;
  amountCents: number;
  reason: string;
  requestedBy: DcRefundRequester;
  /** Short tag for what this refund is: "pledge-cancel", "recoup-refund", "duplicate-charge"… */
  purpose: string;
  /** Same key on a retry of the same refund returns the recorded result instead of re-sending. */
  idempotencyKey?: string;
  partial?: boolean;
  /** What the payment charged, when the caller knows; enables the over-refund cap. */
  chargedCents?: number | null;
  /** Admin has checked the payment in DC's dashboard: proceed past an uncertain or in-flight earlier attempt. */
  force?: boolean;
}

export type DcRefundOutcome =
  | { success: true; refundId: string | null; reused: boolean; attemptId: string; data?: Record<string, unknown> }
  | {
      success: false;
      error: string;
      code?: string;
      /** DC gave no decision (5xx, timeout): the refund may have happened. */
      uncertain?: boolean;
      blocked?: "in_flight" | "uncertain" | "over_refund" | "invalid";
      attemptId?: string;
    };

const IN_FLIGHT_WINDOW_MS = 5 * 60 * 1000;

function extractRefundId(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (typeof data.refundId === "string") return data.refundId;
  if (typeof data.id === "string") return data.id;
  const nested = data.refund;
  if (nested && typeof nested === "object" && typeof (nested as { id?: unknown }).id === "string") {
    return (nested as { id: string }).id;
  }
  return null;
}

function parseMeta(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Cents already refunded against a payment, from both our records. */
export async function dcRefundedCents(paymentId: string, pledgeId: string | null): Promise<number> {
  const attempts = await db.dcRefundAttempt.findMany({
    where: { paymentId, status: "SUCCEEDED" },
    select: { amountCents: true },
  });
  const fromAttempts = attempts.reduce((s: number, a: { amountCents: number }) => s + a.amountCents, 0);

  // Ledger REFUND rows name the intent they drew from in their metadata.
  // Attempts and ledger rows describe the same refunds, so take the larger
  // of the two totals rather than their sum.
  let fromLedger = 0;
  if (pledgeId) {
    const rows = await db.divinityCoinTransaction.findMany({
      where: { pledgeId, type: "REFUND" },
      select: { amount: true, metadata: true },
    });
    for (const row of rows as { amount: unknown; metadata: string | null }[]) {
      const m = parseMeta(row.metadata);
      const names = Object.values(m).some((v) => v === paymentId);
      if (names) fromLedger += Math.round(Math.abs(Number(row.amount)) * 100);
    }
  }
  return Math.max(fromAttempts, fromLedger);
}

export async function requestDcRefund(req: DcRefundRequest): Promise<DcRefundOutcome> {
  const amountCents = Math.round(req.amountCents);
  if (!req.paymentId || !Number.isFinite(amountCents) || amountCents <= 0) {
    return { success: false, error: "Refund needs a payment id and a positive amount", blocked: "invalid" };
  }

  const now = Date.now();
  const inFlightSince = new Date(now - IN_FLIGHT_WINDOW_MS);

  // Attempts that never settled: a PENDING row older than the window is a
  // process that died mid-call, which is the same unknown as UNCERTAIN.
  await db.dcRefundAttempt.updateMany({
    where: { paymentId: req.paymentId, status: "PENDING", createdAt: { lt: inFlightSince } },
    data: { status: "UNCERTAIN", error: "No answer recorded; process may have died mid-call" },
  });

  if (req.idempotencyKey) {
    const prior = await db.dcRefundAttempt.findUnique({ where: { idempotencyKey: req.idempotencyKey } });
    if (prior?.status === "SUCCEEDED") {
      log.info({ paymentId: req.paymentId, key: req.idempotencyKey, refundId: prior.refundId }, "[DC refund] already sent; returning recorded result");
      return { success: true, refundId: prior.refundId, reused: true, attemptId: prior.id };
    }
  }

  const open = await db.dcRefundAttempt.findFirst({
    where: { paymentId: req.paymentId, OR: [{ status: "UNCERTAIN" }, { status: "PENDING" }] },
    orderBy: { createdAt: "desc" },
  });
  if (open && !req.force) {
    const blocked = open.status === "PENDING" ? "in_flight" : "uncertain";
    const error =
      blocked === "in_flight"
        ? `A refund of this payment is already being sent (${open.purpose}, $${(open.amountCents / 100).toFixed(2)}). Wait for it to finish.`
        : `An earlier refund of this payment (${open.purpose}, $${(open.amountCents / 100).toFixed(2)} on ${open.createdAt.toISOString().slice(0, 16).replace("T", " ")}) got no clear answer from DivinityCoin and may have gone through. Check payment ${req.paymentId} in the DC dashboard before refunding again.`;
    log.warn({ paymentId: req.paymentId, purpose: req.purpose, openAttempt: open.id, blocked }, "[DC refund] blocked by an earlier attempt");
    return { success: false, error, blocked, attemptId: open.id };
  }

  // Over-refund cap when the charge is known.
  if (typeof req.chargedCents === "number" && req.chargedCents > 0) {
    const already = await dcRefundedCents(req.paymentId, req.pledgeId);
    if (already + amountCents > req.chargedCents + 1) {
      const error = `Refusing to refund $${(amountCents / 100).toFixed(2)}: $${(already / 100).toFixed(2)} of this $${(req.chargedCents / 100).toFixed(2)} payment is already refunded.`;
      log.warn({ paymentId: req.paymentId, purpose: req.purpose, already, amountCents, charged: req.chargedCents }, "[DC refund] over-refund blocked");
      return { success: false, error, blocked: "over_refund" };
    }
  }

  const attempt = await db.dcRefundAttempt.create({
    data: {
      paymentId: req.paymentId,
      pledgeId: req.pledgeId,
      amountCents,
      purpose: req.purpose.slice(0, 60),
      requestedBy: req.requestedBy,
      idempotencyKey: req.idempotencyKey ?? null,
      status: "PENDING",
    },
  });

  let result: Awaited<ReturnType<typeof callDivinityCoinAPI>>;
  try {
    result = await callDivinityCoinAPI("refund", {
      pledgeId: req.pledgeId ?? undefined,
      paymentId: req.paymentId,
      amount: amountCents,
      reason: req.reason.slice(0, 200),
      requestedBy: req.requestedBy === "system" ? "admin" : req.requestedBy,
      ...(req.partial !== undefined ? { partial: req.partial } : {}),
    });
  } catch (err) {
    result = { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (result.success) {
    const refundId = extractRefundId(result.data);
    await db.dcRefundAttempt.update({ where: { id: attempt.id }, data: { status: "SUCCEEDED", refundId } });
    return { success: true, refundId, reused: false, attemptId: attempt.id, data: result.data };
  }

  const message = result.error || "DivinityCoin refund failed";
  // A coded refusal is a decision (ALREADY_PROCESSED, INSUFFICIENT_BALANCE,
  // invalid amount): nothing moved, safe to retry later. No code means DC
  // fell over before deciding.
  const decided = !!result.code;
  await db.dcRefundAttempt.update({
    where: { id: attempt.id },
    data: { status: decided ? "FAILED" : "UNCERTAIN", error: message.slice(0, 500), code: result.code ?? null },
  });
  if (!decided) {
    log.error({ paymentId: req.paymentId, purpose: req.purpose, attemptId: attempt.id, err: message }, "[DC refund] no decision from DivinityCoin; further refunds of this payment are blocked");
    alertAdmins({
      title: `Refund outcome unknown: ${req.purpose} $${(amountCents / 100).toFixed(2)}`,
      message: `DivinityCoin answered "${message}" to a refund of payment ${req.paymentId}${req.pledgeId ? ` (pledge ${req.pledgeId})` : ""}. It may or may not have gone through. Further refunds of this payment are blocked until you check it in the DC dashboard and either mark the attempt reconciled or retry with force.`,
      actionUrl: "/admin/payouts",
      throttleKey: `dc-refund-uncertain:${req.paymentId}`,
      throttleMinutes: 60,
    }).catch(() => {});
  }
  return { success: false, error: message, code: result.code, uncertain: !decided, attemptId: attempt.id };
}

/**
 * Admin has confirmed in DC's dashboard what happened to an UNCERTAIN
 * attempt: record it so the payment is unblocked. `refundId` means the
 * refund did go through (the attempt becomes SUCCEEDED and counts toward
 * the cap); null means it did not (FAILED).
 */
export async function reconcileDcRefundAttempt(attemptId: string, adminId: string, refundId: string | null): Promise<boolean> {
  const res = await db.dcRefundAttempt.updateMany({
    where: { id: attemptId, status: { in: ["UNCERTAIN", "PENDING"] } },
    data: refundId
      ? { status: "SUCCEEDED", refundId, error: `Reconciled by admin ${adminId}` }
      : { status: "FAILED", error: `Reconciled by admin ${adminId}: not refunded at DC` },
  });
  return res.count > 0;
}
