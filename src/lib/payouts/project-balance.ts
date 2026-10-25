import { db } from "@/lib/db";
import { calculateInternationalFees } from "@/lib/payouts/international-fees";

// The one place the DivinityCoin payout math lives. The admin payouts
// listing and the chargeback recovery scan both need "what does this
// creator still have coming, or owe back" and they must agree to the cent.

export interface DcPayoutMathInput {
  /** Sum of COMPLETED pledge amounts (REFUNDED / CHARGEBACK excluded). */
  totalRaised: number;
  /** Partial refunds issued (REFUND_ISSUED activities flagged partial). */
  partialRefundTotal: number;
  /** COMPLETED pledge count — drives the per-transaction fee. */
  backerCount: number;
  bankCountry: string | null | undefined;
  /** Platform fee as a fraction (0.03 = 3%). */
  platformFeeRate: number;
  /** Sum of COMPLETED settlements already paid to the creator. */
  amountSettled: number;
  /**
   * Money the creator already paid back through charged recoups
   * (disputed principal, not the fee). Credited so a recouped chargeback
   * doesn't also show as "owes back".
   */
  recoveredCredit: number;
  /**
   * Overpaid balance written off as an internal loss (admin-owned
   * campaigns). It only neutralises a negative balance — it is never
   * money to pay out. Counting it as a plain credit paid an overpayment
   * twice once later pledges pushed the balance positive.
   */
  writtenOffCredit?: number;
}

export interface DcPayoutMath {
  effectiveRevenue: number;
  partnerFee: number;
  platformFee: number;
  bankCountry: string;
  isInternational: boolean;
  wireFee: number;
  currencyConversionFee: number;
  totalFees: number;
  amountOwed: number;
  amountSettled: number;
  /** Credit actually applied: charged recoups plus whatever part of a write-off was needed to reach zero. */
  recoveredCredit: number;
  /** Positive = still to pay the creator; negative = creator owes back. */
  remainingAmount: number;
}

/**
 * Charged recoups are real money the creator returned, so they always
 * count. A write-off only absorbs a shortfall: it brings a negative balance
 * up to zero and no further.
 */
export function applyRecoveredCredits(base: number, charged: number, writtenOff: number): { remaining: number; applied: number } {
  const afterCharged = r2(base + charged);
  const writtenOffUsed = afterCharged < 0 ? Math.min(writtenOff, -afterCharged) : 0;
  return { remaining: r2(afterCharged + writtenOffUsed), applied: r2(charged + writtenOffUsed) };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeDcPayoutMath(i: DcPayoutMathInput): DcPayoutMath {
  const effectiveRevenue = r2(i.totalRaised - i.partialRefundTotal);

  // DivinityCoin: 3% partner + $0.30/txn. Platform fee from settings.
  const processorFee = r2(effectiveRevenue * 0.03);
  const perTransactionFee = r2(0.3 * i.backerCount);
  const partnerFee = r2(processorFee + perTransactionFee);
  const platformFee = r2(effectiveRevenue * i.platformFeeRate);
  const platformAndProcessorFees = r2(partnerFee + platformFee);

  // International wire surcharges apply to the post-fee subtotal so the FX
  // margin isn't pyramided on top of our cut.
  const subtotalAfterPlatformFees = r2(effectiveRevenue - platformAndProcessorFees);
  const intl = calculateInternationalFees(i.bankCountry, subtotalAfterPlatformFees);
  const totalFees = r2(platformAndProcessorFees + intl.totalInternationalFees);
  const amountOwed = r2(effectiveRevenue - totalFees);
  const credit = applyRecoveredCredits(r2(amountOwed - i.amountSettled), i.recoveredCredit, i.writtenOffCredit ?? 0);
  const remainingAmount = credit.remaining;

  return {
    effectiveRevenue,
    partnerFee,
    platformFee,
    bankCountry: intl.bankCountry,
    isInternational: intl.isInternational,
    wireFee: intl.wireFee,
    currencyConversionFee: intl.currencyConversionFee,
    totalFees,
    amountOwed,
    amountSettled: i.amountSettled,
    recoveredCredit: credit.applied,
    remainingAmount,
  };
}

export interface RecoveredCredits {
  /** Disputed principal the creator actually paid back from their card. */
  charged: number;
  /** Overpaid balance written off as an internal loss. */
  writtenOff: number;
}

/** Per project: principal collected from the creator's card, and amounts written off, kept separate. */
export async function loadRecoveredCredits(projectIds: string[]): Promise<Map<string, RecoveredCredits>> {
  const out = new Map<string, RecoveredCredits>();
  if (projectIds.length === 0) return out;
  const rows = await db.chargebackRecoup.findMany({
    where: { projectId: { in: projectIds }, status: { in: ["CHARGED", "WRITTEN_OFF"] } },
    select: { projectId: true, disputedAmount: true, status: true },
  });
  for (const row of rows as { projectId: string; disputedAmount: unknown; status: string }[]) {
    const cur = out.get(row.projectId) || { charged: 0, writtenOff: 0 };
    if (row.status === "WRITTEN_OFF") cur.writtenOff = r2(cur.writtenOff + Number(row.disputedAmount));
    else cur.charged = r2(cur.charged + Number(row.disputedAmount));
    out.set(row.projectId, cur);
  }
  return out;
}

export async function loadPlatformFeeRate(): Promise<number> {
  const settings = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: { platformFee: true },
  });
  return settings?.platformFee ? Number(settings.platformFee) / 100 : 0.03;
}

/**
 * Current balance for one DivinityCoin project, computed exactly as the
 * admin payouts listing computes it. Used by the recovery scan so the
 * amount it charges is the amount the admin sees in red.
 */
export async function loadDcProjectBalance(projectId: string): Promise<
  | null
  | (DcPayoutMath & {
      creatorId: string;
      creatorRole: string;
      title: string;
      status: string;
      endDate: Date | null;
      settlementCount: number;
    })
> {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null, paymentProcessor: "DIVINITYCOIN" },
    select: {
      id: true,
      title: true,
      status: true,
      endDate: true,
      creator: {
        select: {
          id: true,
          role: true,
          divinityCoinBankAccount: { select: { bankCountry: true } },
        },
      },
      pledges: { where: { status: "COMPLETED", deletedAt: null }, select: { amount: true } },
      divinityCoinSettlements: { where: { status: "COMPLETED" }, select: { amount: true } },
    },
  });
  if (!project) return null;

  const refundActivities = await db.fulfillmentActivity.findMany({
    where: { projectId, type: "REFUND_ISSUED" },
    select: { metadata: true },
  });
  let partialRefundTotal = 0;
  for (const a of refundActivities) {
    const meta = a.metadata as { isPartialRefund?: boolean; refundAmount?: number | string } | null;
    if (meta?.isPartialRefund) partialRefundTotal = r2(partialRefundTotal + Number(meta.refundAmount || 0));
  }

  const [platformFeeRate, credits] = await Promise.all([
    loadPlatformFeeRate(),
    loadRecoveredCredits([projectId]),
  ]);

  const math = computeDcPayoutMath({
    totalRaised: project.pledges.reduce((s: number, p: { amount: unknown }) => s + Number(p.amount), 0),
    partialRefundTotal,
    backerCount: project.pledges.length,
    bankCountry: project.creator.divinityCoinBankAccount?.bankCountry,
    platformFeeRate,
    amountSettled: project.divinityCoinSettlements.reduce((s: number, x: { amount: unknown }) => s + Number(x.amount), 0),
    recoveredCredit: credits.get(projectId)?.charged || 0,
    writtenOffCredit: credits.get(projectId)?.writtenOff || 0,
  });
  return {
    ...math,
    creatorId: project.creator.id,
    creatorRole: project.creator.role,
    title: project.title,
    status: project.status,
    endDate: project.endDate,
    settlementCount: project.divinityCoinSettlements.length,
  };
}
