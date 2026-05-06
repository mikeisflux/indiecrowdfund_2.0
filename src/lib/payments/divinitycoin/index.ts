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
  handleRefundCompleted,
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
} from "./saved-cards";
