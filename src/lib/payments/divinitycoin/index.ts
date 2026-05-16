// Re-export everything so all existing imports from "@/lib/payments/divinitycoin" continue to work

export type {
  DivinityCoinConfig,
  DivinityCoinEventType,
  DivinityCoinWebhookRequest,
  TestPingResponse,
  CardValidateResponse,
  CardRedeemResponse,
  RefundRequestResponse,
  PaymentEventResponse,
  // Saved-card / off-session charge types
  PaymentMethodSummary,
  CreateSetupIntentResult,
  ListPaymentMethodsResult,
  DetachPaymentMethodResult,
  ChargeSavedPaymentMethodInput,
  ChargeSavedPaymentMethodResult,
  // White-label hosted checkout types (DC partner API 2026-05-15)
  DcCheckoutMode,
  DcCheckoutStatus,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  CheckoutSessionDetails,
  GetCheckoutSessionResult,
} from "./types";

export {
  paymentsDivinitycoinLogger,
  cachedConfig,
  getDivinityCoinConfig,
  getDivinityCoinWebhookSecret,
} from "./config";

export { callDivinityCoinAPI } from "./client";

export { handleCardValidate, handleCardRedeem } from "./cards";

export {
  handleRefundRequest,
  handlePaymentSucceeded,
  handlePaymentFailed,
  handlePaymentRequiresAction,
  handleRefundCompleted,
  handleCheckoutCompleted,
  handleCheckoutFailed,
  handleCheckoutExpired,
  handleCheckoutCanceled,
} from "./payments";

export {
  verifyWebhookSignature,
  constructWebhookEvent,
  handleTestPing,
  handleDivinityCoinWebhook,
} from "./webhooks";

// Saved cards / off-session charge helpers (DC partner API 2026-05-05).
// See ./saved-cards.ts for usage examples and the SetupIntent → save →
// off-session-charge flow.
export {
  createDcSetupIntent,
  listDcPaymentMethods,
  detachDcPaymentMethod,
  chargeDcSavedPaymentMethod,
  verifyDcPayment,
  getDcSetupIntent,
} from "./saved-cards";

// White-label hosted checkout helpers (DC partner API 2026-05-15).
// See ./checkout-sessions.ts. Phase 1 ships the helpers + webhook
// handlers; no caller wires the create flow until Phase 2 lands
// behind the DIVINITYCOIN_HOSTED_CHECKOUT env flag.
export {
  createDcCheckoutSession,
  getDcCheckoutSession,
} from "./checkout-sessions";
