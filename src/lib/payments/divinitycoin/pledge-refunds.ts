import { db } from "@/lib/db";
import { callDivinityCoinAPI } from "./client";
import { lookupDcPayment } from "./saved-cards";
import { paymentsDivinitycoinLogger as log } from "./config";

/**
 * Refund money on a DivinityCoin pledge across EVERY charge that paid for it.
 *
 * A pledge that has been edited is paid by several PaymentIntents: the
 * original checkout plus one upcharge intent per increase. Every refund
 * path used to send the whole amount against `pledge.divinityCoinPaymentId`
 * (the original intent only), so once a backer had edited their order a
 * few times the original intent no longer held enough to cover a decrease
 * and DC rejected the refund outright. The backer saw "Failed to process
 * refund" and could not change their order at all.
 *
 * This walks the charges newest-first (the latest upcharge is the money
 * most likely to be what the backer is now removing), caps each refund at
 * what that intent still holds, and keeps going until the requested amount
 * is covered. Each successful refund is written to DivinityCoinTransaction
 * immediately, with the DC refund id, so the refund webhook that follows
 * recognises it and does not record or unwind it a second time.
 */

export interface DcRefundAllocation {
  paymentIntentId: string;
  amountCents: number;
  refundId: string | null;
}

export interface RefundDcPledgeInput {
  pledge: {
    id: string;
    userId: string;
    divinityCoinPaymentId: string | null;
    metadata: unknown;
  };
  amountCents: number;
  reason: string;
  requestedBy: "user" | "creator" | "admin";
  /** Ledger row description; "(part N)" is appended when split. */
  description: string;
  /** Extra audit fields merged into every ledger row's metadata. */
  ledgerMetadata?: Record<string, unknown>;
  /**
   * Leave shipping / balance-due charges alone. A pledge decrease should
   * come out of the pledge money, not the shipping the backer paid later.
   * A full cancellation refunds everything and passes false.
   */
  excludeBalanceCharges?: boolean;
}

export type RefundDcPledgeResult =
  | { success: true; refundedCents: number; refunds: DcRefundAllocation[] }
  | {
      success: false;
      error: string;
      /** Refunds that DID go through before the failure. Never zero-length silently: callers must account for this money. */
      refundedCents: number;
      refunds: DcRefundAllocation[];
    };

interface Charge {
  paymentIntentId: string;
  /** Cents originally charged, or null when neither DC nor our ledger says. */
  chargedCents: number | null;
  createdAt: number;
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

/** Every string in a metadata object that looks like a payment intent / DC payment id. */
function intentIdsIn(meta: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === "string" && /payment|intent/i.test(k) && v.length >= 8) out.push(v);
  }
  return out;
}

async function collectCharges(input: RefundDcPledgeInput): Promise<{ charges: Charge[]; refundedByIntent: Map<string, number> }> {
  const { pledge } = input;
  const byId = new Map<string, Charge>();

  // DC's own record is the source of truth for what was charged.
  const history = await lookupDcPayment(pledge.id);
  if (history.success) {
    for (const a of history.attempts) {
      if (a?.status !== "succeeded" || typeof a.paymentIntentId !== "string") continue;
      byId.set(a.paymentIntentId, {
        paymentIntentId: a.paymentIntentId,
        chargedCents: typeof a.amount === "number" ? Math.round(a.amount) : null,
        createdAt: typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() || 0 : 0,
      });
    }
  } else {
    log.warn({ pledgeId: pledge.id, err: history.error }, "[DC refund] lookup-payment unavailable; falling back to ledger");
  }

  // Our ledger fills gaps (older pledges, DC outage) and tells us what has
  // already been refunded against each intent.
  const rows = await db.divinityCoinTransaction.findMany({
    where: { pledgeId: pledge.id },
    select: { amount: true, type: true, metadata: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const refundedByIntent = new Map<string, number>();
  const balanceIntents = new Set<string>();
  const meta = (typeof pledge.metadata === "object" && pledge.metadata !== null ? pledge.metadata : {}) as Record<string, unknown>;
  for (const key of ["balancePaymentIntentId", "balanceDivinityCoinPaymentId"]) {
    if (typeof meta[key] === "string") balanceIntents.add(meta[key] as string);
  }

  for (const row of rows) {
    const m = parseMeta(row.metadata);
    const ids = intentIdsIn(m);
    const cents = Math.round(Math.abs(Number(row.amount)) * 100);
    if (row.type === "PAYMENT") {
      const id = (typeof m.paymentId === "string" && m.paymentId) || ids[0];
      if (id && !byId.has(id)) {
        byId.set(id, { paymentIntentId: id, chargedCents: cents || null, createdAt: row.createdAt.getTime() });
      }
    } else if (row.type === "SHIPPING_PAYMENT" || row.type === "BALANCE_PAYMENT") {
      ids.forEach((id) => balanceIntents.add(id));
      const id = ids[0];
      if (id && !byId.has(id)) {
        byId.set(id, { paymentIntentId: id, chargedCents: cents || null, createdAt: row.createdAt.getTime() });
      }
    } else if (row.type === "REFUND") {
      // A refund row names the intent it drew from. Rows written before this
      // helper existed only name the original intent, which is also where
      // they were drawn from, so attributing by any id present is right.
      const target = ids.find((id) => byId.has(id)) ?? ids[0];
      if (target) refundedByIntent.set(target, (refundedByIntent.get(target) ?? 0) + cents);
    }
  }

  // The original intent is always a candidate, even if nothing above knew
  // its amount; DC enforces the real cap when we ask.
  if (pledge.divinityCoinPaymentId && !byId.has(pledge.divinityCoinPaymentId)) {
    byId.set(pledge.divinityCoinPaymentId, { paymentIntentId: pledge.divinityCoinPaymentId, chargedCents: null, createdAt: 0 });
  }

  let charges = [...byId.values()];
  if (input.excludeBalanceCharges) {
    charges = charges.filter((c) => !balanceIntents.has(c.paymentIntentId));
  }

  // Newest first; the original checkout intent goes last whatever its date.
  charges.sort((a, b) => {
    if (a.paymentIntentId === pledge.divinityCoinPaymentId) return 1;
    if (b.paymentIntentId === pledge.divinityCoinPaymentId) return -1;
    return b.createdAt - a.createdAt;
  });

  return { charges, refundedByIntent };
}

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

export async function refundDcPledge(input: RefundDcPledgeInput): Promise<RefundDcPledgeResult> {
  const { pledge } = input;
  const requested = Math.round(input.amountCents);
  if (requested <= 0) {
    return { success: false, error: "Refund amount must be greater than zero", refundedCents: 0, refunds: [] };
  }

  const { charges, refundedByIntent } = await collectCharges(input);
  if (charges.length === 0) {
    return { success: false, error: "No DivinityCoin payment is recorded for this pledge", refundedCents: 0, refunds: [] };
  }

  const refunds: DcRefundAllocation[] = [];
  let remaining = requested;
  let lastError: string | null = null;

  for (const charge of charges) {
    if (remaining <= 0) break;
    const alreadyRefunded = refundedByIntent.get(charge.paymentIntentId) ?? 0;
    const cap = charge.chargedCents === null ? remaining : Math.max(0, charge.chargedCents - alreadyRefunded);
    if (cap <= 0) continue;
    const take = Math.min(remaining, cap);
    const isPartial = charge.chargedCents === null || take < charge.chargedCents - alreadyRefunded || alreadyRefunded > 0;

    const dcResult = await callDivinityCoinAPI("refund", {
      pledgeId: pledge.id,
      paymentId: charge.paymentIntentId,
      amount: take,
      reason: input.reason.slice(0, 200),
      requestedBy: input.requestedBy,
      partial: isPartial,
    });

    if (!dcResult.success) {
      lastError = dcResult.error || "DivinityCoin refund failed";
      log.warn(
        { pledgeId: pledge.id, paymentIntentId: charge.paymentIntentId, take, cap, err: lastError },
        "[DC refund] intent rejected; trying the next charge"
      );
      continue;
    }

    const refundId = extractRefundId(dcResult.data);
    refunds.push({ paymentIntentId: charge.paymentIntentId, amountCents: take, refundId });
    remaining -= take;

    const partIndex = refunds.length;
    await db.divinityCoinTransaction.create({
      data: {
        userId: pledge.userId,
        pledgeId: pledge.id,
        amount: -(take / 100),
        type: "REFUND",
        description: requested > take || partIndex > 1 ? `${input.description} (part ${partIndex})` : input.description,
        metadata: JSON.stringify({
          ...(input.ledgerMetadata ?? {}),
          requestedBy: input.requestedBy,
          reason: input.reason,
          refundedPaymentIntentId: charge.paymentIntentId,
          divinityCoinPaymentId: charge.paymentIntentId,
          originalPaymentId: pledge.divinityCoinPaymentId,
          refundId,
          refundAmount: take / 100,
          requestedAmount: requested / 100,
          partial: isPartial,
          dcRefundResult: dcResult.data ?? null,
          processedAt: new Date().toISOString(),
        }),
      },
    });
  }

  const refundedCents = requested - remaining;
  if (remaining > 0) {
    const error =
      refundedCents > 0
        ? `Only $${(refundedCents / 100).toFixed(2)} of the $${(requested / 100).toFixed(2)} refund could be processed: ${lastError ?? "the remaining charges have nothing left to refund"}`
        : lastError ?? "DivinityCoin has nothing left to refund on this pledge";
    log.error(
      { pledgeId: pledge.id, requested, refundedCents, refunds, err: lastError },
      "[DC refund] could not refund the full amount across the pledge's charges"
    );
    return { success: false, error, refundedCents, refunds };
  }

  log.info({ pledgeId: pledge.id, requested, refunds }, "[DC refund] refunded across charges");
  return { success: true, refundedCents, refunds };
}
