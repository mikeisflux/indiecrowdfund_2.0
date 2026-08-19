import { db } from "@/lib/db";
import { calculateInternationalFees } from "@/lib/payouts/international-fees";

/**
 * What a DivinityCoin campaign is owed, and what is left to pay.
 *
 * Pulled out of the admin payouts GET so the POST that actually moves money
 * can check against the same number. It used to exist only in the GET — the
 * projection that renders the screen — while the POST created a settlement
 * for whatever amount it was handed, with no server-side ceiling. The only
 * duplicate protection was "reject an identical amount within 60 seconds",
 * so a retry a minute later paid the creator a second time.
 *
 * Pure arithmetic on purpose: no database, no I/O. The fee maths is the part
 * that must not drift between the two call sites, and a pure function is the
 * part that can be tested exactly.
 */

export interface OwedInput {
  /** Sum of COMPLETED pledges. Fully-refunded pledges are already excluded. */
  totalRaised: number;
  /** Partial refunds, which do not change pledge status and so must be deducted. */
  partialRefundTotal: number;
  /** COMPLETED pledge count, for the per-transaction fee. */
  backerCount: number;
  /** Platform fee as a fraction (0.03 = 3%). */
  platformFeeRate: number;
  /** Destination bank country; drives the wire + FX surcharges. */
  bankCountry: string | null | undefined;
}

export interface OwedBreakdown {
  effectiveRevenue: number;
  partnerFee: number;
  platformFee: number;
  internationalFees: number;
  totalFees: number;
  amountOwed: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// DivinityCoin partner rate, flat.
const DC_PARTNER_RATE = 0.03;
const DC_PER_TRANSACTION_FEE = 0.3;

export function calculateDivinityCoinOwed(input: OwedInput): OwedBreakdown {
  const effectiveRevenue = round2(input.totalRaised - input.partialRefundTotal);

  const processorFee = round2(effectiveRevenue * DC_PARTNER_RATE);
  const perTransactionFee = round2(DC_PER_TRANSACTION_FEE * input.backerCount);
  const partnerFee = round2(processorFee + perTransactionFee);
  const platformFee = round2(effectiveRevenue * input.platformFeeRate);
  const platformAndProcessorFees = round2(partnerFee + platformFee);

  // The FX margin is taken from the post-platform-fee subtotal so it does not
  // pyramid on top of our own cut.
  const subtotalAfterPlatformFees = round2(effectiveRevenue - platformAndProcessorFees);
  const intl = calculateInternationalFees(input.bankCountry, subtotalAfterPlatformFees);

  const totalFees = round2(platformAndProcessorFees + intl.totalInternationalFees);

  return {
    effectiveRevenue,
    partnerFee,
    platformFee,
    internationalFees: intl.totalInternationalFees,
    totalFees,
    amountOwed: round2(effectiveRevenue - totalFees),
  };
}

// Settlements that represent money already committed to the creator. FAILED
// and CANCELLED are excluded: those never left, so they must not eat into the
// remaining budget or a legitimate retry would be blocked forever.
export const COMMITTED_SETTLEMENT_STATUSES = [
  "PENDING",
  "INITIATED",
  "PROCESSING",
  "COMPLETED",
] as const;

/**
 * How much may still be paid out.
 *
 * Can be negative when a creator was paid in full and refunds landed
 * afterwards — the caller should treat anything <= 0 as "nothing to pay".
 */
export function remainingToSettle(amountOwed: number, alreadyCommitted: number): number {
  return round2(amountOwed - alreadyCommitted);
}

// Money is stored to the cent, and the fee maths rounds at each step, so an
// exact comparison would reject a legitimate "pay the remainder" click that
// is off by a rounding artefact. One cent of slack, no more.
export const SETTLEMENT_ROUNDING_TOLERANCE = 0.01;

// ── Loading the inputs ──────────────────────────────────────────────────────
//
// The calculation above stays pure so it can be tested exactly. This is the
// database half, kept beside it so the two admin settlement routes read the
// same numbers rather than each assembling their own and drifting.

export async function loadDivinityCoinOwed(
  projectId: string,
  bankCountry: string | null | undefined
): Promise<OwedBreakdown> {
  const [totalRaised, backerCount, refundActivities, platformSettings] = await Promise.all([
    db.pledge.aggregate({
      where: { projectId, status: "COMPLETED", deletedAt: null },
      _sum: { amount: true },
    }),
    db.pledge.count({ where: { projectId, status: "COMPLETED", deletedAt: null } }),
    // Partial refunds don't change pledge status, so they're recorded as
    // activity rows and have to be deducted separately.
    db.fulfillmentActivity.findMany({
      where: { projectId, type: "REFUND_ISSUED" },
      select: { metadata: true },
    }),
    db.platformSettings.findUnique({ where: { id: "default" }, select: { platformFee: true } }),
  ]);

  const partialRefundTotal = (refundActivities as { metadata: unknown }[]).reduce((sum, a) => {
    const meta = a.metadata as Record<string, unknown> | null;
    if (!meta?.isPartialRefund) return sum;
    const amount = Number(meta.refundAmount || 0);
    return amount > 0 ? sum + amount : sum;
  }, 0);

  return calculateDivinityCoinOwed({
    totalRaised: Number(totalRaised._sum.amount || 0),
    partialRefundTotal,
    backerCount,
    platformFeeRate: platformSettings?.platformFee ? Number(platformSettings.platformFee) / 100 : 0.03,
    bankCountry,
  });
}

/** Total already sent or in flight for a project, across both admin routes. */
export async function committedSettlementTotal(projectId: string): Promise<number> {
  const committed = await db.divinityCoinSettlement.aggregate({
    where: { projectId, status: { in: [...COMMITTED_SETTLEMENT_STATUSES] } },
    _sum: { amount: true },
  });
  return Number(committed._sum.amount || 0);
}
