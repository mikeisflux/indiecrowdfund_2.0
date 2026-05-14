import { callDivinityCoinAPI } from "./client";
import { paymentsDivinitycoinLogger as log } from "./config";
import type {
  PaymentMethodSummary,
  CreateSetupIntentResult,
  ListPaymentMethodsResult,
  DetachPaymentMethodResult,
  ChargeSavedPaymentMethodInput,
  ChargeSavedPaymentMethodResult,
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
// Charges" (the section partner@ emailed 2026-05-05). Idempotency is
// keyed on `pledgeId` so retrying a charge with the same pledgeId is
// safe — the second call returns the original PaymentIntent.

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
 * Idempotency: pass the local pledge / charge id as `pledgeId`. DC
 * dedupes on (partner, pledgeId), so retrying with the same id returns
 * the same PaymentIntent rather than double-charging.
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
