import { callDivinityCoinAPI } from "./client";
import { paymentsDivinitycoinLogger as log } from "./config";
import type {
  PaymentMethodSummary,
  CreateSetupIntentResult,
  ListPaymentMethodsResult,
  DetachPaymentMethodResult,
  ChargeSavedPaymentMethodInput,
  ChargeSavedPaymentMethodResult,
  DcPaymentAttempt,
  LookupPaymentResult,
} from "./types";

// DivinityCoin saved-card / off-session charge helpers (added 2026-05-05).
//
// The DC partner API gained four new actions that let us save a card on
// the partner's site (us) and later charge it off-session — useful for
// AoN campaign-success charges, balance-due re-pricing, and add-on
// charges where the cardholder isn't actively at checkout.
//
// Card data never touches our servers — the SetupIntent's clientSecret
// is confirmed in the browser via Stripe Elements pointed at DC's own
// publishable key. We only ever store the resulting `pm_...` id.
//
// Wire-level reference: see DC partner docs "Saved Cards & Off-Session
// Charges" (the section partner@ emailed 2026-05-05), as amended by
// partner@ on 2026-08-19 with the `idempotencyKey` field and the
// `lookup-payment` action. See chargeDcSavedPaymentMethod for what
// changed and why it matters.

/**
 * Create a SetupIntent on DC for saving a card under a platform user.
 *
 * Flow:
 *   1. Backend (us): call this to mint a SetupIntent + clientSecret.
 *   2. Frontend: confirm the SetupIntent with Stripe Elements + DC's
 *      publishableKey. The user enters their card; DC tokenizes it.
 *   3. Stripe returns `setupIntent.payment_method` (a `pm_...` id).
 *   4. Backend: persist the pm id on our user record so we can charge
 *      the card later.
 */
export async function createDcSetupIntent(input: {
  platformUserId: string;
  email?: string;
  name?: string;
}): Promise<{ success: false; error: string } | (CreateSetupIntentResult & { success: true })> {
  const result = await callDivinityCoinAPI("create-setup-intent", {
    platformUserId: input.platformUserId,
    email: input.email,
    name: input.name,
  });
  if (!result.success || !result.data) {
    return { success: false, error: result.error || "Failed to create SetupIntent" };
  }
  const data = result.data as Record<string, unknown>;
  if (!data.clientSecret || !data.setupIntentId || !data.publishableKey) {
    log.warn({ data }, "[DivinityCoin] create-setup-intent returned without expected fields");
    return { success: false, error: "DivinityCoin returned an incomplete SetupIntent" };
  }
  return {
    success: true,
    clientSecret: data.clientSecret as string,
    setupIntentId: data.setupIntentId as string,
    publishableKey: data.publishableKey as string,
    customerId: (data.customerId as string | undefined) ?? null,
  };
}

/**
 * List the saved cards (payment methods) for a platform user. Use this
 * to render a "saved cards" picker on the pledge / checkout / settings
 * page so users can pick an existing card or save a new one.
 */
export async function listDcPaymentMethods(
  platformUserId: string
): Promise<ListPaymentMethodsResult> {
  const result = await callDivinityCoinAPI("list-payment-methods", { platformUserId });
  if (!result.success || !result.data) {
    return { success: false, paymentMethods: [], error: result.error };
  }
  const data = result.data as Record<string, unknown>;
  const methods = Array.isArray(data.paymentMethods)
    ? (data.paymentMethods as PaymentMethodSummary[])
    : [];
  return { success: true, paymentMethods: methods };
}

/**
 * Detach (remove) a saved card. DC verifies the card belongs to this
 * platformUserId before detaching; mismatched ownership returns a 404
 * which we surface as a generic "not found" so we don't leak whose
 * card it was.
 */
export async function detachDcPaymentMethod(input: {
  platformUserId: string;
  paymentMethodId: string;
}): Promise<DetachPaymentMethodResult> {
  const result = await callDivinityCoinAPI("detach-payment-method", {
    platformUserId: input.platformUserId,
    paymentMethodId: input.paymentMethodId,
  });
  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

/**
 * Charge a previously-saved card off-session. Use this for:
 *   - AoN campaign success: charge each pledged card when goal is hit.
 *   - Balance-due flows: re-charge for unfulfilled balance after a
 *     creator adds new items.
 *   - Add-ons: charge an additional amount for a backer-confirmed
 *     add-on without re-prompting for card.
 *
 * Idempotency — read this before adding a retry.
 *
 * Idempotency is enforced by Stripe, not by DC, and Stripe caches the
 * FIRST result for a key for 24 hours *including card declines*. With no
 * `idempotencyKey` the key is derived from `pledgeId`, so a retry inside
 * that window replays the cached response without the bank ever being
 * contacted. Our funded-campaign backoff was [1h, 6h, 24h, 72h, 168h] and
 * the first two were therefore guaranteed no-ops; the 24h one sits on the
 * boundary and is nondeterministic. (Confirmed by DC partner@ 2026-08-19.)
 *
 * The rule that follows from that:
 *
 *   - A DECLINE is a definitive answer. To genuinely re-ask the bank, the
 *     next attempt must carry a NEW `idempotencyKey` ("attempt-2", …).
 *   - A NETWORK ERROR / TIMEOUT is not an answer. We don't know whether the
 *     capture landed, so the next attempt must REUSE the same key — inside
 *     24h that is guaranteed to return the original PaymentIntent instead of
 *     charging twice. Past 24h the key has been pruned and a blind retry
 *     WILL double-charge, so call `lookupDcPayment` first.
 *
 * `pledgeId` is never part of that knob — see the type's comment.
 *
 * Decline shape: HTTP 402 from DC turns into `{ success: false }` here
 * with `code` / `declineCode` populated so the caller can surface the
 * cardholder-friendly reason ("Insufficient funds", "Do not honor", …).
 */
export async function chargeDcSavedPaymentMethod(
  input: ChargeSavedPaymentMethodInput
): Promise<ChargeSavedPaymentMethodResult> {
  const payload: Record<string, unknown> = {
    platformUserId: input.platformUserId,
    paymentMethodId: input.paymentMethodId,
    amount: input.amount,
    currency: input.currency || "usd",
    pledgeId: input.pledgeId,
  };
  // Omitted entirely when absent — DC documents "omit it and you get today's
  // behaviour exactly", so sending an explicit undefined/null is not the same
  // thing and must not leak into the JSON body.
  if (input.idempotencyKey) payload.idempotencyKey = input.idempotencyKey;
  if (input.projectId) payload.projectId = input.projectId;
  if (input.description) payload.description = input.description;
  if (input.statement_descriptor) payload.statement_descriptor = input.statement_descriptor;

  const result = await callDivinityCoinAPI("charge-saved-payment-method", payload);
  if (!result.success || !result.data) {
    return {
      success: false,
      status: "failed",
      error: result.error || "Charge failed",
    };
  }
  const data = result.data as Record<string, unknown>;

  // DC returns success: false on declines (HTTP 402). The callDivinityCoinAPI
  // wrapper treats !response.ok as a hard failure, so a 402 already turned
  // into the early return above. The remaining branch here is the success
  // path where the gateway charged and DC echoed back the PI id.
  return {
    success: data.success === true,
    status: (data.status as string) || "succeeded",
    paymentIntentId: data.paymentIntentId as string | undefined,
    amount: data.amount as number | undefined,
    code: data.code as string | undefined,
    declineCode: data.declineCode as string | undefined,
    clientSecret: data.clientSecret as string | undefined,
    error: data.error as string | undefined,
  };
}

/**
 * Verify a PaymentIntent's outcome server-side. DC checks the charge
 * against Stripe and its own record and returns the settled status.
 * Use this as a safety net when a payment.succeeded / payment.failed
 * webhook may have been missed — e.g. an immediate-charge pledge stuck
 * in PENDING after a funded-campaign checkout.
 */
export async function verifyDcPayment(
  paymentIntentId: string
): Promise<
  | { success: false; error: string }
  | {
      success: true;
      status: "succeeded" | "pending" | "failed";
      amount?: number;
      dcStatus?: string;
    }
> {
  const result = await callDivinityCoinAPI("verify-payment", { paymentIntentId });
  if (!result.success || !result.data) {
    return { success: false, error: result.error || "Failed to verify payment" };
  }
  const data = result.data as Record<string, unknown>;
  // Anything DC doesn't explicitly report as succeeded/failed is treated
  // as still pending — the conservative choice, so we never complete or
  // fail a pledge on an ambiguous response.
  const status: "succeeded" | "pending" | "failed" =
    data.status === "succeeded"
      ? "succeeded"
      : data.status === "failed"
        ? "failed"
        : "pending";
  return {
    success: true,
    status,
    amount: typeof data.amount === "number" ? data.amount : undefined,
    dcStatus: typeof data.dcStatus === "string" ? data.dcStatus : undefined,
  };
}

/**
 * Every charge attempt DC has on record for a pledge, with live processor
 * status, plus DC's own `hasSuccessfulCharge` verdict.
 *
 * This is the answer to "my charge call timed out — did the money move?".
 * `verifyDcPayment` cannot answer it: that takes a PaymentIntent id, and the
 * whole problem with a timeout is that we never received one. Ask this before
 * re-charging a pledge whose previous attempt ended in an uncertain state,
 * rather than retrying blind and risking a double charge once Stripe has
 * pruned the idempotency key at 24h.
 *
 * Unresolvable calls return `success: false`, which callers must treat as
 * "still don't know" — never as "no charge exists".
 */
export async function lookupDcPayment(pledgeId: string): Promise<LookupPaymentResult> {
  const result = await callDivinityCoinAPI("lookup-payment", { pledgeId });
  if (!result.success || !result.data) {
    return { success: false, error: result.error || "Failed to look up payment" };
  }
  const data = result.data as Record<string, unknown>;

  // Only a literal true counts. A missing field means DC didn't tell us, and
  // treating that as "no successful charge" is exactly the assumption that
  // double-charges someone.
  if (typeof data.hasSuccessfulCharge !== "boolean") {
    log.warn({ pledgeId, keys: Object.keys(data) }, "[DivinityCoin] lookup-payment returned no hasSuccessfulCharge");
    return { success: false, error: "DivinityCoin returned an incomplete payment lookup" };
  }

  const attempts: DcPaymentAttempt[] = Array.isArray(data.attempts)
    ? (data.attempts as DcPaymentAttempt[])
    : [];

  // Prefer a top-level PI if DC supplies one, else the succeeded attempt's.
  const succeeded = attempts.find((a) => a?.status === "succeeded");
  const paymentIntentId =
    (typeof data.paymentIntentId === "string" ? data.paymentIntentId : null) ??
    (typeof succeeded?.paymentIntentId === "string" ? succeeded.paymentIntentId : null);

  return {
    success: true,
    hasSuccessfulCharge: data.hasSuccessfulCharge,
    paymentIntentId,
    attempts,
  };
}

/**
 * Retrieve a SetupIntent's live status from DC. Once the SetupIntent has
 * succeeded the response includes the resulting paymentMethodId — use
 * this to recover the saved-card token when the browser flow couldn't
 * hand it back directly (e.g. a 3DS challenge that did a full-page
 * redirect away from checkout).
 */
export async function getDcSetupIntent(
  setupIntentId: string
): Promise<
  | { success: false; error: string }
  | { success: true; status: string; paymentMethodId: string | null }
> {
  const result = await callDivinityCoinAPI("get-setup-intent", { setupIntentId });
  if (!result.success || !result.data) {
    return { success: false, error: result.error || "Failed to retrieve SetupIntent" };
  }
  const data = result.data as Record<string, unknown>;
  return {
    success: true,
    status: typeof data.status === "string" ? data.status : "unknown",
    paymentMethodId:
      typeof data.paymentMethodId === "string" ? data.paymentMethodId : null,
  };
}
