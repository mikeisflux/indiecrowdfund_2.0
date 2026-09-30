import { ProjectPaymentData } from "@/types";
import { BankCountry } from "@/lib/bank-countries";

export interface ContactEmailSectionProps {
  payment: Partial<ProjectPaymentData>;
  updatePayment: (data: Partial<ProjectPaymentData>) => void;
  projectId: string | null;
}

export interface ProjectTypeSectionProps {
  payment: Partial<ProjectPaymentData>;
  updatePayment: (data: Partial<ProjectPaymentData>) => void;
}

export interface ContentDeclarationSectionProps {
  payment: Partial<ProjectPaymentData>;
  updatePayment: (data: Partial<ProjectPaymentData>) => void;
  hasAdultContent: boolean | undefined;
}

export interface PaymentProcessorSectionProps {
  payment: Partial<ProjectPaymentData>;
  updatePayment: (data: Partial<ProjectPaymentData>) => void;
  mustUseAltProcessor: boolean | undefined;
  campaignType: "ALL_OR_NOTHING" | "KEEP_IT_ALL";
  isLaunched?: boolean;
  goalAmount: number;
  platformFee: number;
  paypalFee: number;
  paypalTotalFees: number;
  paypalNetAmount: number;
  whopFee: number;
  whopTotalFees: number;
  whopNetAmount: number;
}

export interface StripeConnectSectionProps {
  stripeStatus: {
    connected: boolean;
    onboarded: boolean;
    loading: boolean;
    error: string | null;
  };
  connectError: string | null;
  isConnecting: boolean;
  isResetting: boolean;
  handleConnectStripe: () => Promise<void>;
  setShowResetConfirm: (show: boolean) => void;
}

export interface DivinityCoinBankSectionProps {
  bankAccount: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    routingNumber: string;
    accountType: "checking" | "savings";
    // ISO 3166-1 alpha-2 of the bank's country (US / GB / IT). Drives
    // routing-format labels + validation and whether the payout phone
    // field shows. Defaults to "US". See @/lib/bank-countries.
    bankCountry: BankCountry;
    payoutPhone: string;
    billingLine1: string;
    billingLine2: string;
    billingCity: string;
    billingState: string;
    billingZip: string;
    billingCountry: string;
  };
  setBankAccount: React.Dispatch<React.SetStateAction<{
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    routingNumber: string;
    accountType: "checking" | "savings";
    bankCountry: BankCountry;
    payoutPhone: string;
    billingLine1: string;
    billingLine2: string;
    billingCity: string;
    billingState: string;
    billingZip: string;
    billingCountry: string;
  }>>;
  bankAccountStatus: {
    saved: boolean;
    loading: boolean;
    lastFour: string | null;
  };
  setBankAccountStatus: React.Dispatch<React.SetStateAction<{
    saved: boolean;
    loading: boolean;
    lastFour: string | null;
  }>>;
  isSavingBank: boolean;
  handleSaveBankAccount: () => Promise<void>;
}

export interface RetailerAccessSectionProps {
  payment: Partial<ProjectPaymentData>;
  updatePayment: (data: Partial<ProjectPaymentData>) => void;
}

export interface ChargebackCardStatus {
  saved: boolean;
  loading: boolean;
  /** Held as a DivinityCoin vault token (chargeable). False = legacy row needing re-entry. */
  vaulted: boolean;
  lastFour: string | null;
  brand: string | null;
  expMonth: number | null;
  expYear: number | null;
}

export interface ChargebackCardSectionProps {
  chargebackCardStatus: ChargebackCardStatus;
  setChargebackCardStatus: React.Dispatch<React.SetStateAction<ChargebackCardStatus>>;
  projectId: string | null;
}
