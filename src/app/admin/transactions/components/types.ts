// Types
export interface UnifiedTransaction {
  id: string;
  type: "PLEDGE" | "MARKETPLACE" | "DC_TRANSACTION" | "DC_REDEMPTION" | "PAYOUT" | "SETTLEMENT";
  userId: string;
  userName: string | null;
  userEmail: string;
  userImage: string | null;
  projectId: string | null;
  projectName: string | null;
  itemDescription: string;
  amount: number;
  currency: string;
  processorFees: number;
  platformFees: number;
  paymentProcessor: string | null;
  stripePaymentIntentId: string | null;
  stripeSetupIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  divinityCoinPaymentId: string | null;
  externalTransactionId: string | null;
  status: string;
  failureReason: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  chargedImmediately: boolean | null;
  createdAt: string;
  completedAt: string | null;
  refundedAt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface TransactionStats {
  totalTransactions: number;
  totalVolume: number;
  pledgeCount: number;
  pledgeVolume: number;
  pledgeCompleted: number;
  pledgeFailed: number;
  pledgePending: number;
  pledgeRefunded: number;
  marketplaceCount: number;
  marketplaceVolume: number;
  failedTransactions: number;
  refundedTransactions: number;
  stripeTransactions: number;
  dcTransactions: number;
  todayTransactions: number;
  todayVolume: number;
  totalPlatformFees: number;
  totalProcessorFees: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TransactionDetail {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface StripeLookupResult {
  lookupType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stripe?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  databaseMatch?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diagnostics?: Record<string, any>;
}
