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
  // SCA / 3DS backstop (DC partner API 2026-05-15). Fires when DC's
  // synchronous response to charge-saved-payment-method got lost (server
  // crash, network blip) and the PaymentIntent enters requires_action
  // server-side. Includes the clientSecret so we can drive the challenge
  // from a recovery surface if needed.
  | "payment.requires_action"
  | "refund.completed"
  // White-label hosted checkout session events (DC partner API 2026-05-15).
  // At-most-once on DC's side so they're safe to dedupe against the
  // existing payment.* events for PAYMENT-mode sessions, and they are
  // the ONLY signal for SETUP-mode sessions (no payment.* fires there).
  | "checkout.completed"
  | "checkout.failed"
  | "checkout.expired"
  | "checkout.canceled";

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
    // DC's current `payment.failed` schema sends the decline message in
    // `error`; older payloads (and our own outbound `refund.request`)
    // used `reason`. Read both for resilience.
    error?: string;
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
    // Hosted checkout + requires_action backstop (DC partner API 2026-05-15)
    sessionId?: string;          // cs_... for checkout.* events
    mode?: "payment" | "setup";  // checkout.* session mode
    paymentIntentId?: string;    // pi_... — set on requires_action + checkout.completed (PAYMENT mode)
    setupIntentId?: string;      // seti_... — set on checkout.completed (SETUP mode)
    paymentMethodId?: string;    // pm_... — set on checkout.completed when status=complete
    clientSecret?: string;       // present on payment.requires_action for recovery
    nextActionType?: "use_stripe_sdk" | "redirect_to_url" | null;
    type?: "initial" | "upcharge"; // present on payment.requires_action
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

// ============================================================
// Saved cards / off-session charges (DC partner API 2026-05-05)
// ============================================================

// One saved card returned by /list-payment-methods. DC's full shape
// includes more fields (customer, billing details, etc.) — we only
// type the ones the UI consumes.
export interface PaymentMethodSummary {
  id: string;             // pm_... — the value to pass to charge / detach
  brand: string;          // "visa" | "mastercard" | "amex" | "discover" | …
  last4: string;
  expMonth: number;
  expYear: number;
}

// /create-setup-intent success payload, normalized for our callers.
export interface CreateSetupIntentResult {
  clientSecret: string;   // confirm with stripe.confirmCardSetup() in the browser
  setupIntentId: string;  // seti_...
  publishableKey: string; // DC's Stripe pk_live_... — point Stripe Elements at this
  customerId: string | null;
}

// /list-payment-methods normalized result. paymentMethods is always an
// array (empty when the user has no cards on file) so callers can map
// without null-checking.
export type ListPaymentMethodsResult =
  | { success: true; paymentMethods: PaymentMethodSummary[] }
  | { success: false; paymentMethods: PaymentMethodSummary[]; error?: string };

// /detach-payment-method normalized result.
export type DetachPaymentMethodResult =
  | { success: true }
  | { success: false; error?: string };

// /charge-saved-payment-method input.
//
// `pledgeId` is the reconciliation id, NOT a free-form idempotency knob. DC
// persists it and echoes it back in payment.* webhooks, so it must always be
// the real local pledge id — mutating or suffixing it breaks reconciliation
// on both sides (and makes handlePaymentSucceeded fail to find the pledge).
//
// `idempotencyKey` is the knob. Omit it and DC keys idempotency on pledgeId
// alone, which is what you want for the first attempt. Pass a distinct value
// ("attempt-2", "addon-<id>") when you deliberately want a NEW authorization
// against the same pledge. See the note on chargeDcSavedPaymentMethod for why
// a decline retry needs one and a network-error retry must not.
export interface ChargeSavedPaymentMethodInput {
  platformUserId: string;
  paymentMethodId: string;     // pm_... from list-payment-methods
  amount: number;              // cents
  pledgeId: string;            // local pledge id — reconciliation key, never mangled
  idempotencyKey?: string;     // omit for the first attempt; see above
  currency?: string;           // default "usd"
  projectId?: string;          // links the charge to the campaign on DC's reporting
  description?: string;        // shows up on DC's dashboard
  statement_descriptor?: string; // ≤22 chars; shows on the cardholder's statement
}

// One prior charge attempt against a pledge, from /lookup-payment. DC returns
// live processor status rather than its own cached copy, so this is the
// authority on "did the money actually move".
export interface DcPaymentAttempt {
  paymentIntentId?: string;
  status?: string;             // "succeeded" | "failed" | "processing" | …
  amount?: number;             // cents
  createdAt?: string;
  [key: string]: unknown;
}

export type LookupPaymentResult =
  | { success: false; error: string }
  | {
      success: true;
      /** DC's own verdict. Authoritative — do not re-derive it from attempts. */
      hasSuccessfulCharge: boolean;
      /** PI of the successful attempt, when there is one. */
      paymentIntentId: string | null;
      attempts: DcPaymentAttempt[];
    };

// /charge-saved-payment-method normalized result. On success, status is
// typically "succeeded" and `paymentIntentId` is set. On a soft decline
// (DC returns HTTP 402) `success` is false, `code`/`declineCode` carry
// the gateway reason, and `clientSecret` lets a frontend retry with
// 3DS / new card if appropriate.
export interface ChargeSavedPaymentMethodResult {
  success: boolean;
  status: string;             // "succeeded" | "requires_payment_method" | "requires_action" | …
  paymentIntentId?: string;   // pi_...
  amount?: number;            // cents charged
  code?: string;              // e.g. "card_declined"
  declineCode?: string;       // e.g. "insufficient_funds", "do_not_honor"
  clientSecret?: string;      // for frontend recovery on 3DS / requires_action
  error?: string;             // cardholder-friendly message
}

// ============================================================
// White-label hosted checkout (DC partner API 2026-05-15)
// ============================================================
//
// DC hosts the card capture surface at divinitycoin.com/checkout/cs_...
// We create a session, redirect the user, they complete (or save) a
// card on DC's branded page, and DC redirects them back to our
// returnUrl with ?session_id=... — then we call get-checkout-session
// to learn the outcome. SETUP mode also yields a paymentMethodId we
// can later off-session-charge.
//
// PAYMENT-mode sessions still fire the existing payment.succeeded /
// payment.failed webhooks (the underlying PaymentIntent is created
// up-front), so refund + bookkeeping behave identically. SETUP-mode
// sessions only fire the new checkout.* events.

export type DcCheckoutMode = "payment" | "setup";

export type DcCheckoutStatus =
  | "pending"
  | "complete"
  | "failed"
  | "expired"
  | "canceled";

export interface CreateCheckoutSessionInput {
  mode?: DcCheckoutMode;            // default "payment"
  platformUserId: string;
  email: string;
  returnUrl: string;
  cancelUrl?: string;
  partnerLogoUrl?: string;
  description?: string;
  expiresInMinutes?: number;        // 1-1440, default 30
  // When true, DC skips the default top-nav-to-returnUrl on session
  // completion. The "complete" postMessage still fires (with this
  // value echoed in the payload) and the partner page owns what
  // happens next. Required for iframe embeds where the parent wants
  // to keep the user inline and transition its own UI on completion
  // — DC's default nav would yank the top window to returnUrl
  // before the partner's React handler had a chance to finish.
  disableAutoRedirect?: boolean;
  // PAYMENT-mode only:
  amount?: number;                  // cents, >0
  currency?: string;                // default "usd"
  pledgeId?: string;
  projectId?: string;
}

export interface CreateCheckoutSessionResult {
  success: true;
  sessionId: string;                // cs_...
  checkoutUrl: string;              // https://divinitycoin.com/checkout/cs_...
  expiresAt: string;                // ISO
}

export interface CheckoutSessionDetails {
  sessionId: string;
  status: DcCheckoutStatus;
  mode: DcCheckoutMode;
  amount: number | null;            // null in setup mode
  currency: string;
  pledgeId: string | null;          // null in setup mode
  projectId: string | null;         // null in setup mode
  paymentIntentId: string | null;   // set in payment mode
  setupIntentId: string | null;     // set in setup mode
  paymentMethodId: string | null;   // set once status=complete
  platformUserId: string;
  email: string;
  expiresAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface GetCheckoutSessionResult {
  success: true;
  session: CheckoutSessionDetails;
}
