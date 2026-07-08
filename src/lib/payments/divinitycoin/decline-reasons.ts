// Map Stripe-style declineCode / code values from DC's gateway responses
// into messages a backer can act on. DC mirrors Stripe's decline codes
// (insufficient_funds, do_not_honor, expired_card, etc.) on its
// charge-saved-payment-method failures.
//
// Used anywhere a saved-card or hosted-checkout charge declines and we
// need to show the user a reason rather than the raw code or a generic
// "Payment failed". The map intentionally errs toward instructing the
// backer what to do next (try another card, contact bank) — for the
// codes where the bank's refusal is opaque ("do not honor") we say so
// instead of inventing a reason.

const DECLINE_CODE_MESSAGES: Record<string, string> = {
  insufficient_funds: "Your card doesn't have enough available funds. Try another card or contact your bank.",
  do_not_honor: "Your bank declined the charge without giving a specific reason. Contact your bank to authorize it, or try a different card.",
  generic_decline: "Your bank declined the charge. Try a different card or contact your bank.",
  card_declined: "Your card was declined. Try a different card or contact your bank.",
  expired_card: "Your card has expired. Please use a different card.",
  incorrect_cvc: "The card security code (CVC) you entered didn't match. Re-enter the CVC and try again.",
  incorrect_number: "The card number is incorrect. Please re-check the number.",
  invalid_cvc: "The card security code (CVC) is invalid. Re-enter and try again.",
  invalid_expiry_month: "The expiration month on the card is invalid.",
  invalid_expiry_year: "The expiration year on the card is invalid.",
  invalid_number: "The card number is invalid. Please re-check it.",
  lost_card: "This card was reported lost. Please use a different card.",
  stolen_card: "This card was reported stolen. Please use a different card.",
  pickup_card: "Your bank requested we don't accept this card. Use a different card.",
  restricted_card: "This card has restrictions that prevent the charge. Use a different card or contact your bank.",
  processing_error: "Your bank reported a processing error. Try again in a moment, or use a different card.",
  card_velocity_exceeded: "Your card has hit its transaction limit. Wait a bit and try again, or use a different card.",
  card_not_supported: "This card type isn't supported. Try a different card.",
  currency_not_supported: "This card doesn't support charges in this currency. Try a different card.",
  fraudulent: "Your bank flagged the charge as potentially fraudulent. Contact your bank to authorize, or use a different card.",
  withdrawal_count_limit_exceeded: "You've reached your bank's withdrawal limit. Wait a bit, or use a different card.",
  testmode_decline: "The card was declined because it's a test card.",
  authentication_required: "Your bank requires additional authentication for this charge. Please complete the verification step.",
  approve_with_id: "Your bank can't approve this charge automatically. Contact your bank to authorize it.",
  call_issuer: "Your bank needs to authorize this charge directly. Please contact them.",
  duplicate_transaction: "This looks like a duplicate of a recent charge. Wait a moment and try again if needed.",
  new_account_information_available: "Your card has new account information. Please update the card on file.",
  not_permitted: "This type of transaction isn't permitted on the card. Use a different card.",
  service_not_allowed: "The card-issuing bank doesn't allow this service. Use a different card.",
  transaction_not_allowed: "Your bank doesn't allow this type of transaction. Contact your bank or use a different card.",
};

// Convert a DC/Stripe decline outcome into a backer-friendly sentence.
// Pass declineCode (the precise Stripe-style code) and/or code (the
// higher-level outcome like "card_declined"). Falls back to the upstream
// error string if neither code is one we recognize, and finally to a
// generic message so we never surface an empty error to the user.
export function formatDeclineReason(input: {
  declineCode?: string;
  code?: string;
  fallbackError?: string;
}): string {
  const { declineCode, code, fallbackError } = input;
  if (declineCode && DECLINE_CODE_MESSAGES[declineCode]) {
    return DECLINE_CODE_MESSAGES[declineCode];
  }
  if (code && DECLINE_CODE_MESSAGES[code]) {
    return DECLINE_CODE_MESSAGES[code];
  }
  if (fallbackError && fallbackError.trim().length > 0) {
    return fallbackError;
  }
  return "Your card was declined. Try a different card or contact your bank.";
}
