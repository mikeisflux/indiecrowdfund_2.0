import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

// ============================================
// WISE API CLIENT CONFIGURATION
// ============================================

const WISE_API_URL = process.env.WISE_ENVIRONMENT === "production"
  ? "https://api.wise.com"
  : "https://api.sandbox.transferwise.tech";

interface WiseApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

async function wiseApiRequest<T>(
  endpoint: string,
  options: WiseApiOptions = {}
): Promise<T> {
  const apiToken = process.env.WISE_API_TOKEN;

  if (!apiToken) {
    throw new Error("WISE_API_TOKEN environment variable is not set");
  }

  const { method = "GET", body, headers = {} } = options;

  const response = await fetch(`${WISE_API_URL}${endpoint}`, {
    method,
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Wise API error: ${response.status} - ${JSON.stringify(errorData)}`
    );
  }

  return response.json();
}

// ============================================
// PROFILE MANAGEMENT
// ============================================

export interface WiseProfile {
  id: number;
  type: "personal" | "business";
  details: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    companyType?: string;
  };
}

export async function getWiseProfiles(): Promise<WiseProfile[]> {
  return wiseApiRequest<WiseProfile[]>("/v1/profiles");
}

export async function getPlatformProfile(): Promise<WiseProfile> {
  const profiles = await getWiseProfiles();
  const platformProfileId = process.env.WISE_PROFILE_ID;

  if (platformProfileId) {
    const profile = profiles.find((p) => p.id === parseInt(platformProfileId));
    if (profile) return profile;
  }

  // Default to first business profile or first profile
  return profiles.find((p) => p.type === "business") || profiles[0];
}

// ============================================
// RECIPIENT MANAGEMENT (Creator Bank Accounts)
// ============================================

export interface RecipientAccountRequest {
  currency: string;
  type: string;
  profile: number;
  accountHolderName: string;
  details: {
    legalType: "PRIVATE" | "BUSINESS";
    abartn?: string;  // ACH routing number
    accountNumber?: string;
    accountType?: "CHECKING" | "SAVINGS";
    address?: {
      country: string;
      city: string;
      postCode: string;
      firstLine: string;
    };
  };
}

export interface RecipientAccount {
  id: number;
  profileId: number;
  accountHolderName: string;
  type: string;
  currency: string;
  active: boolean;
  details: Record<string, unknown>;
}

export async function createRecipient(
  profileId: number,
  recipientData: Omit<RecipientAccountRequest, "profile">
): Promise<RecipientAccount> {
  return wiseApiRequest<RecipientAccount>("/v1/accounts", {
    method: "POST",
    body: {
      ...recipientData,
      profile: profileId,
    },
  });
}

export async function getRecipient(recipientId: number): Promise<RecipientAccount> {
  return wiseApiRequest<RecipientAccount>(`/v1/accounts/${recipientId}`);
}

export async function listRecipients(profileId: number): Promise<RecipientAccount[]> {
  return wiseApiRequest<RecipientAccount[]>(`/v1/accounts?profile=${profileId}`);
}

// ============================================
// QUOTES (Required before creating transfers)
// ============================================

export interface QuoteRequest {
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount?: number;
  targetAmount?: number;
  profileId: number;
}

export interface Quote {
  id: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  targetAmount: number;
  rate: number;
  fee: number;
  paymentOptions: PaymentOption[];
  expirationTime: string;
}

export interface PaymentOption {
  payIn: string;
  payOut: string;
  fee: {
    total: number;
    transferwise: number;
  };
  sourceAmount: number;
  targetAmount: number;
  estimatedDelivery: string;
}

export async function createQuote(data: QuoteRequest): Promise<Quote> {
  return wiseApiRequest<Quote>("/v3/quotes", {
    method: "POST",
    body: {
      sourceCurrency: data.sourceCurrency,
      targetCurrency: data.targetCurrency,
      sourceAmount: data.sourceAmount,
      targetAmount: data.targetAmount,
      profile: data.profileId,
    },
  });
}

export async function getQuote(quoteId: string): Promise<Quote> {
  return wiseApiRequest<Quote>(`/v3/quotes/${quoteId}`);
}

// ============================================
// TRANSFERS (Payouts to Creators)
// ============================================

export interface TransferRequest {
  targetAccount: number;
  quoteUuid: string;
  customerTransactionId: string;
  details?: {
    reference?: string;
    transferPurpose?: string;
  };
}

export interface Transfer {
  id: number;
  user: number;
  targetAccount: number;
  sourceAccount: number | null;
  quote: number;
  quoteUuid: string;
  status: TransferStatus;
  rate: number;
  created: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceValue: number;
  targetValue: number;
  customerTransactionId: string;
}

export type TransferStatus =
  | "incoming_payment_waiting"
  | "incoming_payment_initiated"
  | "processing"
  | "funds_converted"
  | "outgoing_payment_sent"
  | "completed"
  | "cancelled"
  | "funds_refunded"
  | "bounced_back";

export async function createTransfer(data: TransferRequest): Promise<Transfer> {
  return wiseApiRequest<Transfer>("/v1/transfers", {
    method: "POST",
    body: data,
  });
}

export async function getTransfer(transferId: number): Promise<Transfer> {
  return wiseApiRequest<Transfer>(`/v1/transfers/${transferId}`);
}

export async function fundTransfer(
  profileId: number,
  transferId: number
): Promise<{ status: string; errorCode?: string }> {
  return wiseApiRequest(`/v3/profiles/${profileId}/transfers/${transferId}/payments`, {
    method: "POST",
    body: {
      type: "BALANCE",
    },
  });
}

export async function cancelTransfer(transferId: number): Promise<Transfer> {
  return wiseApiRequest<Transfer>(`/v1/transfers/${transferId}/cancel`, {
    method: "PUT",
  });
}

// ============================================
// BALANCE & BORDERLESS ACCOUNTS
// ============================================

export interface Balance {
  id: number;
  currency: string;
  amount: {
    value: number;
    currency: string;
  };
  reservedAmount: {
    value: number;
    currency: string;
  };
}

export async function getBalances(profileId: number): Promise<Balance[]> {
  return wiseApiRequest<Balance[]>(`/v4/profiles/${profileId}/balances?types=STANDARD`);
}

export async function getBalance(
  profileId: number,
  currency: string
): Promise<Balance | undefined> {
  const balances = await getBalances(profileId);
  return balances.find((b) => b.currency === currency);
}

// ============================================
// CARD ISSUANCE
// ============================================

export interface CardRequest {
  profileId: number;
  cardType: "VIRTUAL" | "PHYSICAL";
  currency: string;
  design?: string;
}

export interface WiseCard {
  id: string;
  profileId: number;
  type: "VIRTUAL" | "PHYSICAL";
  status: "ACTIVE" | "FROZEN" | "CANCELLED" | "PENDING";
  currency: string;
  lastFour: string;
  expiryDate: string;
  createdAt: string;
}

export async function issueCard(data: CardRequest): Promise<WiseCard> {
  return wiseApiRequest<WiseCard>(`/v1/profiles/${data.profileId}/cards`, {
    method: "POST",
    body: {
      type: data.cardType,
      currency: data.currency,
      design: data.design || "default",
    },
  });
}

export async function getCard(profileId: number, cardId: string): Promise<WiseCard> {
  return wiseApiRequest<WiseCard>(`/v1/profiles/${profileId}/cards/${cardId}`);
}

export async function listCards(profileId: number): Promise<WiseCard[]> {
  return wiseApiRequest<WiseCard[]>(`/v1/profiles/${profileId}/cards`);
}

export async function freezeCard(profileId: number, cardId: string): Promise<WiseCard> {
  return wiseApiRequest<WiseCard>(`/v1/profiles/${profileId}/cards/${cardId}/freeze`, {
    method: "POST",
  });
}

export async function unfreezeCard(profileId: number, cardId: string): Promise<WiseCard> {
  return wiseApiRequest<WiseCard>(`/v1/profiles/${profileId}/cards/${cardId}/unfreeze`, {
    method: "POST",
  });
}

// ============================================
// PAYMENT INTEGRATION (Receiving funds from backers)
// ============================================

export interface PayInDetails {
  id: string;
  profileId: number;
  currency: string;
  bankDetails: {
    accountNumber: string;
    routingNumber?: string;
    iban?: string;
    bic?: string;
    bankName: string;
    bankAddress: string;
  };
  reference: string;
}

export async function getPayInDetails(
  profileId: number,
  currency: string
): Promise<PayInDetails> {
  return wiseApiRequest<PayInDetails>(
    `/v1/profiles/${profileId}/pay-in-methods?currency=${currency}`
  );
}

// ============================================
// PLATFORM PAYMENT FLOWS
// ============================================

interface CreatePledgePaymentParams {
  projectId: string;
  rewardId: string;
  addonIds: string[];
  amount: number;
  userId: string;
  isNsfw: boolean;
}

interface PaymentResult {
  pledgeId: string;
  paymentMethod: "CARD" | "ACH";
  paymentDetails: {
    // For ACH payments
    bankDetails?: {
      accountNumber: string;
      routingNumber: string;
      bankName: string;
      reference: string;
    };
    // For card payments (Wise Checkout Widget)
    checkoutUrl?: string;
    clientReferenceId?: string;
  };
}

export async function createPledgePayment({
  projectId,
  rewardId,
  addonIds,
  amount,
  userId,
  isNsfw,
}: CreatePledgePaymentParams): Promise<PaymentResult> {
  // Get project details
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      creator: {
        include: {
          wiseConfig: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Force ACH for NSFW campaigns
  const paymentMethod = isNsfw ? "ACH" : "CARD";

  // Create pending pledge
  const pledge = await db.pledge.create({
    data: {
      userId,
      projectId,
      rewardId,
      amount,
      rewardAmount: amount,
      paymentProcessor: isNsfw ? "ACH_ONLY" : "WISE",
      status: "PENDING",
    },
  });

  // Create addon records if any
  if (addonIds.length > 0) {
    const addons = await db.reward.findMany({
      where: {
        id: { in: addonIds },
        type: "ADDON",
      },
      select: { id: true, amount: true },
    });

    await db.pledgeAddon.createMany({
      data: addons.map((addon) => ({
        pledgeId: pledge.id,
        addonId: addon.id,
        quantity: 1,
        amount: addon.amount,
      })),
    });
  }

  // Get platform profile for receiving payments
  const platformProfile = await getPlatformProfile();

  if (paymentMethod === "ACH") {
    // Get ACH pay-in details for the platform
    const payInDetails = await getPayInDetails(platformProfile.id, "USD");

    // Generate unique reference for this pledge
    const reference = `PLG-${pledge.id.slice(0, 8).toUpperCase()}`;

    // Update pledge with reference
    await db.pledge.update({
      where: { id: pledge.id },
      data: { wisePayInReference: reference },
    });

    return {
      pledgeId: pledge.id,
      paymentMethod: "ACH",
      paymentDetails: {
        bankDetails: {
          accountNumber: payInDetails.bankDetails.accountNumber,
          routingNumber: payInDetails.bankDetails.routingNumber || "",
          bankName: payInDetails.bankDetails.bankName,
          reference,
        },
      },
    };
  }

  // For card payments, generate checkout URL
  const clientReferenceId = `${pledge.id}-${uuidv4()}`;

  // Update pledge with reference
  await db.pledge.update({
    where: { id: pledge.id },
    data: { wisePayInReference: clientReferenceId },
  });

  // Return checkout details for Wise Checkout Widget
  return {
    pledgeId: pledge.id,
    paymentMethod: "CARD",
    paymentDetails: {
      checkoutUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pledge/${pledge.id}/checkout`,
      clientReferenceId,
    },
  };
}

// ============================================
// PAYOUT TO CREATORS
// ============================================

interface PayoutToCreatorParams {
  creatorId: string;
  projectId: string;
  amountUSD: number;
  isNsfw?: boolean;
}

export async function payoutToCreator({
  creatorId,
  projectId,
  amountUSD,
  isNsfw = false,
}: PayoutToCreatorParams): Promise<Transfer> {
  // Get creator's Wise configuration
  const creator = await db.user.findUnique({
    where: { id: creatorId },
    include: { wiseConfig: true },
  });

  if (!creator || !creator.wiseConfig) {
    throw new Error("Creator has not connected Wise account");
  }

  if (!creator.wiseConfig.wiseRecipientId) {
    throw new Error("Creator has not set up bank account for payouts");
  }

  // Force ACH for NSFW creators
  if (isNsfw && creator.wiseConfig.preferredPayout === "WISE_CARD") {
    throw new Error("NSFW campaigns can only receive payouts via ACH");
  }

  // Get platform profile
  const platformProfile = await getPlatformProfile();

  // Create quote for the payout
  const quote = await createQuote({
    sourceCurrency: "USD",
    targetCurrency: creator.wiseConfig.bankCurrency || "USD",
    sourceAmount: amountUSD,
    profileId: platformProfile.id,
  });

  // Calculate fees
  const wiseFee = quote.fee;
  const platformFee = amountUSD * 0.05; // 5% platform fee
  const netAmount = amountUSD - wiseFee - platformFee;

  // Create the transfer
  const transfer = await createTransfer({
    targetAccount: parseInt(creator.wiseConfig.wiseRecipientId),
    quoteUuid: quote.id,
    customerTransactionId: uuidv4(),
    details: {
      reference: `Payout for project ${projectId}`,
      transferPurpose: "PAYMENT_FOR_GOODS_OR_SERVICES",
    },
  });

  // Fund the transfer from platform balance
  await fundTransfer(platformProfile.id, transfer.id);

  // Record payout in database
  await db.payout.create({
    data: {
      projectId,
      creatorId,
      amount: netAmount,
      grossAmount: amountUSD,
      wiseFees: wiseFee,
      platformFees: platformFee,
      wiseTransferId: transfer.id.toString(),
      wiseQuoteId: quote.id,
      wiseRecipientId: creator.wiseConfig.wiseRecipientId,
      sourceCurrency: "USD",
      targetCurrency: creator.wiseConfig.bankCurrency || "USD",
      exchangeRate: quote.rate,
      type: "CAMPAIGN",
      status: "PROCESSING",
      payoutMethod: creator.wiseConfig.preferredPayout,
      bankAccountLast4: creator.wiseConfig.bankAccountLast4,
      estimatedArrival: quote.paymentOptions[0]?.estimatedDelivery
        ? new Date(quote.paymentOptions[0].estimatedDelivery)
        : undefined,
    },
  });

  return transfer;
}

// ============================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================

import crypto from "crypto";

export function verifyWiseWebhook(
  payload: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(payload);
    return verifier.verify(publicKey, signature, "base64");
  } catch {
    return false;
  }
}

// ============================================
// FEE CALCULATIONS
// ============================================

export interface FeeBreakdown {
  grossAmount: number;
  wiseFee: number;
  platformFee: number;
  netAmount: number;
  feePercentage: number;
}

export function calculateWiseFees(
  amount: number,
  isInternational: boolean = false
): FeeBreakdown {
  // Wise fees vary, but approximate for USD
  // Domestic ACH: ~0.2-0.8%
  // Card payments: ~1.7-2.9%
  // International: ~0.4-1.5%

  const wiseRate = isInternational ? 0.012 : 0.005; // 1.2% international, 0.5% domestic
  const platformRate = 0.05; // 5% platform fee

  const wiseFee = amount * wiseRate;
  const platformFee = amount * platformRate;
  const netAmount = amount - wiseFee - platformFee;

  return {
    grossAmount: amount,
    wiseFee: Math.round(wiseFee * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
    feePercentage: Math.round((wiseFee + platformFee) / amount * 10000) / 100,
  };
}

// ============================================
// CREATOR ONBOARDING
// ============================================

interface OnboardCreatorParams {
  userId: string;
  email: string;
  profileType: "personal" | "business";
  returnUrl: string;
}

export async function initiateCreatorOnboarding({
  userId,
  profileType,
  returnUrl,
}: OnboardCreatorParams): Promise<{ onboardingUrl: string }> {
  // For Wise Platform API, creators are onboarded through Wise's hosted flow
  // This requires Platform API access from Wise

  // Create or update WiseConfig for the user
  await db.wiseConfig.upsert({
    where: { userId },
    create: {
      userId,
      profileType,
      kycStatus: "pending",
    },
    update: {
      profileType,
      kycStatus: "pending",
    },
  });

  // Generate onboarding URL
  // Note: This is a simplified version - actual implementation requires
  // Wise Platform Partner access and OAuth flow
  const onboardingUrl = `${WISE_API_URL}/oauth/authorize?` +
    `client_id=${process.env.WISE_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(returnUrl)}&` +
    `state=${userId}&` +
    `scope=transfers`;

  return { onboardingUrl };
}

export async function completeCreatorOnboarding(
  userId: string,
  wiseProfileId: string,
  wiseRecipientId: string
): Promise<void> {
  await db.wiseConfig.update({
    where: { userId },
    data: {
      wiseProfileId,
      wiseRecipientId,
      isOnboarded: true,
      kycStatus: "verified",
      kycVerifiedAt: new Date(),
    },
  });
}

// ============================================
// CARD ISSUANCE FOR CREATORS
// ============================================

interface IssueCreatorCardParams {
  userId: string;
  cardType: "VIRTUAL" | "PHYSICAL";
  currency?: string;
}

export async function issueCreatorCard({
  userId,
  cardType,
  currency = "USD",
}: IssueCreatorCardParams): Promise<WiseCard> {
  const wiseConfig = await db.wiseConfig.findUnique({
    where: { userId },
  });

  if (!wiseConfig || !wiseConfig.wiseProfileId) {
    throw new Error("Creator must complete Wise onboarding first");
  }

  if (!wiseConfig.isOnboarded || wiseConfig.kycStatus !== "verified") {
    throw new Error("Creator must complete KYC verification first");
  }

  // Issue the card through Wise API
  const card = await issueCard({
    profileId: parseInt(wiseConfig.wiseProfileId),
    cardType,
    currency,
  });

  // Update WiseConfig with card details
  await db.wiseConfig.update({
    where: { userId },
    data: {
      hasWiseCard: true,
      wiseCardId: card.id,
      cardLast4: card.lastFour,
      cardType: card.type,
      cardStatus: card.status,
    },
  });

  return card;
}

export { wiseApiRequest };
