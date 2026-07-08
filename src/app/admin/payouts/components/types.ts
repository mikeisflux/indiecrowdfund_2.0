// Refund entry for display
export interface RefundEntry {
  id: string;
  type: "full" | "partial";
  amount: number;
  backerName: string | null;
  backerEmail: string;
  reason: string | null;
  date: string;
}

// Creator project payout interface
export interface CreatorProject {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  status: string;
  paymentProcessor?: string;
  fundedAt: string | null;
  totalRaised: number;
  effectiveRevenue: number;
  processorFee: number;
  perTransactionFee: number;
  partnerFee: number;
  platformFee: number;
  // International wire transfer surcharges. Both zero for US banks.
  // wireFee is a flat $25 SWIFT/correspondent-bank pass-through; the
  // CC fee is 1.5% of the subtotal before wire charges. See
  // src/lib/payouts/international-fees.ts for the calculation.
  bankCountry: string;
  isInternational: boolean;
  wireFee: number;
  currencyConversionFee: number;
  totalFees: number;
  amountOwed: number;
  amountSettled: number;
  remainingAmount: number;
  backerCount: number;
  hasBank: boolean;
  bankVerified: boolean;
  hasPendingSettlement: boolean;
  // Refund tracking
  totalRefunded: number;
  fullRefundTotal: number;
  fullRefundCount: number;
  partialRefundTotal: number;
  partialRefundCount: number;
  refunds: RefundEntry[];
  settlementStatus: "pending" | "processing" | "settled" | "overpaid";
  creator: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    bankAccount: {
      id: string;
      bankName: string | null;
      accountLastFour: string | null;
      accountType: string;
      isVerified: boolean;
    } | null;
  };
  settlements: {
    id: string;
    amount: number;
    status: string;
    processedAt: string | null;
    completedAt: string | null;
  }[];
}

export interface PayoutStats {
  totalProjects: number;
  pendingPayouts: number;
  processingPayouts: number;
  settledPayouts: number;
  overpaidPayouts: number;
  totalAmountOwed: number;
  totalAmountSettled: number;
  totalRemaining: number;
  totalRefunded: number;
  totalOverpaid: number;
  projectsWithoutBank: number;
}

export interface BankAccountDetails {
  id: string;
  userId: string;
  user: { id: string; name: string | null; email: string };
  bankName: string;
  bankNameDisplay: string | null;
  accountHolder: string;
  accountNumber: string;
  accountLastFour: string | null;
  routingNumber: string;
  accountType: string;
  // ISO 3166-1 alpha-2 country code that drove routing-format selection
  // at collection time (US ABA vs UK Sort Code vs IT/JP). Always present —
  // the schema defaults legacy rows to "US".
  bankCountry: string;
  // Decrypted at /api/admin/bank-accounts/[id]. Only populated when the
  // creator entered one (required for UK accounts, optional elsewhere).
  payoutPhone: string | null;
  // Decrypted billing address from the bank-account form. Required for
  // KYC + chargeback reconciliation; null for historical rows from
  // before the form captured it.
  billingLine1: string | null;
  billingLine2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingZip: string | null;
  billingCountry: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
}

// Creator balance interface for creators with projects
export interface CreatorBalance {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  balance: number;
  projectCount: number;
  projectEarnings: number;
  projects: {
    id: string;
    title: string;
    status: string;
    amount: number;
  }[];
  marketplaceSales: {
    totalAmount: number;
    creatorEarnings: number;
    count: number;
  };
  hasBank: boolean;
  bankVerified: boolean;
  bankAccount: {
    id: string;
    bankName: string | null;
    accountLastFour: string | null;
    accountType: string;
    isVerified: boolean;
  } | null;
  settlements: {
    id: string;
    amount: number;
    status: string;
    processedAt: string | null;
    completedAt: string | null;
  }[];
}

export interface BalanceStats {
  totalCreatorsWithBalance: number;
  totalBalance: number;
  creatorsWithoutBank: number;
}
