import { ProjectPaymentData } from "@/types";

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
  stripeFee: number;
  platformFee: number;
  totalFees: number;
  netAmount: number;
  // PayPal-specific (3.49% + $0.49/txn)
  paypalFee: number;
  paypalTotalFees: number;
  paypalNetAmount: number;
  // Whop-specific (3% Whop + 2.9% card processing)
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
  };
  setBankAccount: React.Dispatch<React.SetStateAction<{
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    routingNumber: string;
    accountType: "checking" | "savings";
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

export interface ChargebackCardSectionProps {
  chargebackCard: {
    cardNumber: string;
    expMonth: string;
    expYear: string;
    cvc: string;
    billingName: string;
    billingLine1: string;
    billingLine2: string;
    billingCity: string;
    billingState: string;
    billingZip: string;
    billingCountry: string;
  };
  setChargebackCard: React.Dispatch<React.SetStateAction<{
    cardNumber: string;
    expMonth: string;
    expYear: string;
    cvc: string;
    billingName: string;
    billingLine1: string;
    billingLine2: string;
    billingCity: string;
    billingState: string;
    billingZip: string;
    billingCountry: string;
  }>>;
  chargebackCardStatus: {
    saved: boolean;
    loading: boolean;
    lastFour: string | null;
    brand: string | null;
    expMonth: number | null;
    expYear: number | null;
  };
  setChargebackCardStatus: React.Dispatch<React.SetStateAction<{
    saved: boolean;
    loading: boolean;
    lastFour: string | null;
    brand: string | null;
    expMonth: number | null;
    expYear: number | null;
  }>>;
  isSavingCard: boolean;
  handleSaveChargebackCard: () => Promise<void>;
  projectId: string | null;
}
