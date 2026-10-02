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
  recoveredCredit: number;
  /** Positive = still to pay the creator; negative = creator owes back. */
  remainingAmount: number;
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
  const remainingAmount = r2(amountOwed - i.amountSettled + i.recoveredCredit);

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
    recoveredCredit: i.recoveredCredit,
    remainingAmount,
  };
}

/** Disputed principal already collected from the creator's card — or written off as an internal loss — per project. */
export async function loadRecoveredCredits(projectIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (projectIds.length === 0) return out;
  const rows = await db.chargebackRecoup.findMany({
    where: { projectId: { in: projectIds }, status: { in: ["CHARGED", "WRITTEN_OFF"] } },
    select: { projectId: true, disputedAmount: true },
  });
  for (const row of rows) {
    out.set(row.projectId, r2((out.get(row.projectId) || 0) + Number(row.disputedAmount)));
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
  | (DcPayoutMath & { creatorId: string; creatorRole: string; title: string })
> {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null, paymentProcessor: "DIVINITYCOIN" },
    select: {
      id: true,
      title: true,
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
    recoveredCredit: credits.get(projectId) || 0,
  });
  return { ...math, creatorId: project.creator.id, creatorRole: project.creator.role, title: project.title };
}
