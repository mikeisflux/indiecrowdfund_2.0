import { apiFetch } from "@/lib/fetch-utils";

// Helper function to get shipping cost for a country
export function getShippingCost(
  shippingCost: Record<string, number> | number,
  shippingType: string,
  country: string
): number {
  if (shippingType === "NO_SHIPPING") return 0;
  if (typeof shippingCost === "number") return shippingCost;
  if (!shippingCost) return 0;
  if (shippingType === "WORLDWIDE") {
    return shippingCost["WORLDWIDE"] || 0;
  }
  if (shippingCost[country] !== undefined) {
    return shippingCost[country];
  }
  if (shippingCost["WW"] !== undefined) {
    return shippingCost["WW"];
  }
  return 0;
}

// Create additional items purchase for existing pledge
export async function createAdditionalItemsPurchase(
  existingPledgeId: string,
  selectedAddons: Record<string, number>,
  addItemsTotal: number
): Promise<{
  clientSecret?: string;
  publishableKey?: string;
  type?: string;
  pledgeId: string;
  paymentMethod?: string;
}> {
  const addonsWithQuantity = Object.entries(selectedAddons).map(([id, quantity]) => ({
    id,
    quantity,
  }));

  const response = await apiFetch(`/api/pledges/${existingPledgeId}/add-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", },
    body: JSON.stringify({
      addons: addonsWithQuantity,
      amount: addItemsTotal,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to create additional items purchase");
  }

  if (!data.clientSecret) {
    throw new Error("Invalid payment response - missing client secret");
  }

  return {
    clientSecret: data.clientSecret,
    publishableKey: data.publishableKey,
    type: data.type || "payment_intent",
    pledgeId: existingPledgeId,
    paymentMethod: data.paymentMethod || "STRIPE",
  };
}

// Modify an existing pledge (change reward/addons)
export async function modifyPledge(
  pledgeId: string,
  rewardId: string,
  addons: { id: string; quantity: number }[],
  newAmount: number,
  shippingAmount: number,
  shippingCountry: string
): Promise<{
  success: boolean;
  requiresPayment: boolean;
  paymentMethod?: string;
  clientSecret?: string;
  publishableKey?: string;
  amountDiff?: number;
  refundAmount?: number;
  message: string;
}> {
  const response = await apiFetch(`/api/pledges/${pledgeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", },
    body: JSON.stringify({
      action: "modify",
      rewardId,
      addons,
      newAmount,
      shippingAmount,
      shippingCountry,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to modify pledge");
  }

  return {
    success: data.success,
    requiresPayment: data.requiresPayment || false,
    paymentMethod: data.paymentMethod,
    clientSecret: data.clientSecret,
    publishableKey: data.publishableKey,
    amountDiff: data.amountDiff,
    refundAmount: data.refundAmount,
    message: data.message,
  };
}

// Create new pledge for payment
export async function createPledgeForPayment(
  projectId: string,
  rewardId: string | null,
  selectedAddons: Record<string, number>,
  total: number,
  totalShipping: number,
  shippingCountry: string
): Promise<{
  pledgeId: string;
  paymentMethod?: string;
  clientSecret?: string;
  publishableKey?: string;
  type?: string;
  paypalOrderId?: string;
  // PayPal Connect (marketplace): the seller's merchant id for the buyer SDK.
  paypalConnectMerchantId?: string;
  paypalConnect?: boolean;
  whopSessionId?: string;
  // DivinityCoin white-label hosted checkout (DC partner API 2026-05-15).
  // When the server returns type === "hosted_checkout", the client
  // redirects to checkoutUrl instead of mounting Stripe Elements.
  // sessionId is informational — DC appends ?session_id=... to our
  // returnUrl, and the existing handleSuccessRedirect effect picks
  // it up to dispatch /confirm-dc-checkout.
  checkoutUrl?: string;
  sessionId?: string;
}> {
  const addonsWithQuantity = Object.entries(selectedAddons).map(([id, quantity]) => ({
    id,
    quantity,
  }));

  // 30s client-side safety timeout. The route's outbound DC call already
  // has its own 15s abort, but the fetch itself can hang for reasons
  // outside that (browser extension intercepting, ISP-level stalls,
  // mid-flight response loss) — without this, the OrderSummary spinner
  // sits at "Setting up payment…" forever with no error, no retry path,
  // and no entry in our server logs. After 30s we bail with a clean
  // retryable message the backer can act on.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await apiFetch("/api/pledges", {
      method: "POST",
      headers: { "Content-Type": "application/json", },
      body: JSON.stringify({
        projectId,
        rewardId,
        addons: addonsWithQuantity,
        amount: total,
        shippingAmount: totalShipping,
        shippingCountry,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Connection timed out. Please check your network and try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to create pledge");
  }

  return {
    pledgeId: data.pledgeId,
    paymentMethod: data.paymentMethod,
    clientSecret: data.clientSecret,
    publishableKey: data.publishableKey,
    type: data.type,
    paypalOrderId: data.paypalOrderId,
    whopSessionId: data.whopSessionId,
    checkoutUrl: data.checkoutUrl,
    sessionId: data.sessionId,
  };
}

// Confirm payment after success
export async function confirmPayment(pledgeId: string, isAddItemsMode: boolean, isModifyMode?: boolean): Promise<void> {
  let endpoint: string;
  if (isModifyMode) {
    endpoint = `/api/pledges/${pledgeId}/confirm-modify`;
  } else if (isAddItemsMode) {
    endpoint = `/api/pledges/${pledgeId}/confirm-add-items`;
  } else {
    endpoint = `/api/pledges/${pledgeId}/confirm`;
  }

  const response = await apiFetch(endpoint, {
    method: "POST",
    
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to confirm payment");
  }
}
