// DivinityCoin API configuration
export interface DivinityCoinConfig {
  apiKey: string;
  partnerId: string;
  webhookSecret: string;
  baseUrl: string;
}

// Webhook event types supported by DivinityCoin
export type DivinityCoinEventType =
  | "test.ping"
  | "card.validate"
  | "card.redeem"
  | "refund.request"
  | "payment.succeeded"
  | "payment.failed"
  | "refund.completed";

// Webhook request structure from DivinityCoin
export interface DivinityCoinWebhookRequest {
  event: DivinityCoinEventType;
  data?: {
    cardCode?: string;
    platformUserId?: string;
    // Refund request fields
    refundId?: string;
    amount?: number;
    reason?: string;
    originalTransactionId?: string; // DivinityCoin's transaction ID from when the card was redeemed
    originalCardCode?: string; // The card code that was redeemed
    // Payment event fields (new seamless flow)
    paymentId?: string; // DC's internal payment ID
    pledgeId?: string; // IndieK's pledge ID
    projectId?: string;
    holdId?: string; // DC's hold ID for credits
    stripePaymentIntentId?: string; // DC's Stripe PI ID
    giftCardCode?: string; // Auto-generated gift card (for compliance)
    email?: string;
    [key: string]: unknown;
  };
}

// Webhook response structures
export interface TestPingResponse {
  success: true;
  message: string;
  partnerId: string;
  sandboxMode: boolean;
}

export interface CardValidateResponse {
  valid: boolean;
  status: string;
  amount: number;
  error?: string;
}

export interface CardRedeemResponse {
  success: boolean;
  amount: number;
  newBalance?: number;
  error?: string;
}

export interface RefundRequestResponse {
  success: boolean;
  refundId: string;
  amountDeducted: number;
  previousBalance: number;
  newBalance: number;
  userId?: string; // The user whose balance was affected
  error?: string;
  errorCode?: "INSUFFICIENT_BALANCE" | "USER_NOT_FOUND" | "REDEMPTION_NOT_FOUND" | "INVALID_AMOUNT" | "ALREADY_PROCESSED";
}

// Response for payment events
export interface PaymentEventResponse {
  success: boolean;
  message?: string;
  error?: string;
}
