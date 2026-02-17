import Stripe from "stripe";

// Statuses that allow cancellation
const CANCELABLE_SETUP_INTENT_STATUSES = ["requires_payment_method", "requires_confirmation", "requires_action"];
const CANCELABLE_PAYMENT_INTENT_STATUSES = ["requires_payment_method", "requires_confirmation", "requires_action", "requires_capture", "processing"];

/**
 * Safely cancel a SetupIntent - only if it's in a cancelable state
 * Prevents errors from trying to cancel succeeded/canceled intents
 */
export async function safeCancelSetupIntent(stripeClient: Stripe, setupIntentId: string): Promise<boolean> {
  try {
    const setupIntent = await stripeClient.setupIntents.retrieve(setupIntentId);
    if (CANCELABLE_SETUP_INTENT_STATUSES.includes(setupIntent.status)) {
      await stripeClient.setupIntents.cancel(setupIntentId);
      return true;
    }
    // Already succeeded, canceled, or in terminal state - nothing to do
    return false;
  } catch {
    // Intent doesn't exist or other error - nothing to do
    return false;
  }
}

/**
 * Safely cancel a PaymentIntent - only if it's in a cancelable state
 * Prevents errors from trying to cancel succeeded/canceled intents
 */
export async function safeCancelPaymentIntent(stripeClient: Stripe, paymentIntentId: string): Promise<boolean> {
  try {
    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
    if (CANCELABLE_PAYMENT_INTENT_STATUSES.includes(paymentIntent.status)) {
      await stripeClient.paymentIntents.cancel(paymentIntentId);
      return true;
    }
    // Already succeeded, canceled, or in terminal state - nothing to do
    return false;
  } catch {
    // Intent doesn't exist or other error - nothing to do
    return false;
  }
}
