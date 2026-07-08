import { callDivinityCoinAPI } from "./client";
import { paymentsDivinitycoinLogger as log } from "./config";
import type {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  GetCheckoutSessionResult,
  DcCheckoutMode,
  DcCheckoutStatus,
} from "./types";

// DivinityCoin white-label hosted checkout helpers (DC partner API 2026-05-15).
//
// Per-call opt-in alternative to the direct create-setup-intent /
// create-payment-intent flow. Use this when you want DC to host the
// card capture surface — every Stripe Elements / 3DS / brand-UI
// pixel lives on divinitycoin.com instead of our domain, which is
// what makes the "no Stripe visible in our network tab" requirement
// achievable.
//
// Flow:
//   1. Backend: createDcCheckoutSession() → returns checkoutUrl + cs_...
//   2. Persist the cs_... on our pledge (divinityCoinCheckoutSessionId).
//   3. Client: window.location.href = checkoutUrl. User pays / saves
//      card on divinitycoin.com.
//   4. DC redirects back to returnUrl with ?session_id=cs_...
//   5. Backend: getDcCheckoutSession() to learn the outcome (and the
//      paymentMethodId for SETUP mode).
//
// Webhooks fire in parallel (checkout.completed / .failed / .expired /
// .canceled) as a backstop — both paths converge on the same commit
// helper via CAS, so neither double-counts.

/**
 * Create a hosted checkout session. Returns the checkoutUrl we should
 * redirect the user to and the cs_... id we should persist on the
 * pledge for later reconciliation.
 *
 * PAYMENT mode requires amount + pledgeId + projectId; SETUP mode
 * doesn't (DC creates a SetupIntent for the customer that can later
 * be charged via charge-saved-payment-method).
 */
export async function createDcCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<{ success: false; error: string } | CreateCheckoutSessionResult> {
  const mode: DcCheckoutMode = input.mode || "payment";

  if (mode === "payment") {
    if (!input.amount || input.amount <= 0) {
      return { success: false, error: "amount (cents, > 0) required for payment-mode checkout" };
    }
    if (!input.pledgeId) {
      return { success: false, error: "pledgeId required for payment-mode checkout" };
    }
    if (!input.projectId) {
      return { success: false, error: "projectId required for payment-mode checkout" };
    }
  }

  const payload: Record<string, unknown> = {
    mode,
    platformUserId: input.platformUserId,
    email: input.email,
    returnUrl: input.returnUrl,
  };
  if (input.cancelUrl) payload.cancelUrl = input.cancelUrl;
  if (input.partnerLogoUrl) payload.partnerLogoUrl = input.partnerLogoUrl;
  if (input.description) payload.description = input.description;
  if (input.expiresInMinutes) payload.expiresInMinutes = input.expiresInMinutes;
  if (input.disableAutoRedirect) payload.disableAutoRedirect = true;
  if (mode === "payment") {
    payload.amount = input.amount;
    payload.currency = input.currency || "usd";
    payload.pledgeId = input.pledgeId;
    payload.projectId = input.projectId;
  }

  const result = await callDivinityCoinAPI("create-checkout-session", payload);
  if (!result.success || !result.data) {
    return { success: false, error: result.error || "Failed to create checkout session" };
  }
  const data = result.data as Record<string, unknown>;
  if (!data.sessionId || !data.checkoutUrl || !data.expiresAt) {
    log.warn({ data }, "[DivinityCoin] create-checkout-session returned without expected fields");
    return { success: false, error: "DivinityCoin returned an incomplete checkout session" };
  }
  return {
    success: true,
    sessionId: data.sessionId as string,
    checkoutUrl: data.checkoutUrl as string,
    expiresAt: data.expiresAt as string,
  };
}

/**
 * Look up the current state of a hosted checkout session. DC self-heals
 * on this call: if their local session is still pending but the
 * underlying PaymentIntent / SetupIntent has settled at the processor,
 * they refresh before responding — so this is the authoritative status
 * once the user has returned from divinitycoin.com.
 *
 * Use after the user lands on returnUrl?session_id=cs_..., or as a
 * safety net if a checkout.* webhook is ever missed.
 */
export async function getDcCheckoutSession(
  sessionId: string
): Promise<{ success: false; error: string } | GetCheckoutSessionResult> {
  const result = await callDivinityCoinAPI("get-checkout-session", { sessionId });
  if (!result.success || !result.data) {
    return { success: false, error: result.error || "Failed to retrieve checkout session" };
  }
  const data = result.data as Record<string, unknown>;
  const session = (data.session ?? data) as Record<string, unknown>;
  if (!session.sessionId || !session.status || !session.mode) {
    log.warn({ data }, "[DivinityCoin] get-checkout-session returned without expected fields");
    return { success: false, error: "DivinityCoin returned an incomplete checkout session payload" };
  }
  return {
    success: true,
    session: {
      sessionId: session.sessionId as string,
      status: session.status as DcCheckoutStatus,
      mode: session.mode as DcCheckoutMode,
      amount: typeof session.amount === "number" ? session.amount : null,
      currency: typeof session.currency === "string" ? session.currency : "usd",
      pledgeId: typeof session.pledgeId === "string" ? session.pledgeId : null,
      projectId: typeof session.projectId === "string" ? session.projectId : null,
      paymentIntentId: typeof session.paymentIntentId === "string" ? session.paymentIntentId : null,
      setupIntentId: typeof session.setupIntentId === "string" ? session.setupIntentId : null,
      paymentMethodId: typeof session.paymentMethodId === "string" ? session.paymentMethodId : null,
      platformUserId: (session.platformUserId as string) || "",
      email: (session.email as string) || "",
      expiresAt: (session.expiresAt as string) || "",
      completedAt: typeof session.completedAt === "string" ? session.completedAt : null,
      createdAt: (session.createdAt as string) || "",
    },
  };
}
