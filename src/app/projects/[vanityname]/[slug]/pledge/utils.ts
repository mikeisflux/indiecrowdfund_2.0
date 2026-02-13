import { getCSRFHeaders } from "@/lib/csrf";

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
  type?: string;
  pledgeId: string;
  paymentMethod?: string;
}> {
  const addonsWithQuantity = Object.entries(selectedAddons).map(([id, quantity]) => ({
    id,
    quantity,
  }));

  const response = await fetch(`/api/pledges/${existingPledgeId}/add-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
    body: JSON.stringify({
      addons: addonsWithQuantity,
      amount: addItemsTotal,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to create additional items purchase");
  }

  // Chain2Pay and DivinityCoin don't return a clientSecret - payment is handled separately
  if (data.paymentMethod === "CHAIN2PAY" || data.paymentMethod === "DIVINITYCOIN") {
    return {
      pledgeId: existingPledgeId,
      paymentMethod: data.paymentMethod,
    };
  }

  if (!data.clientSecret) {
    throw new Error("Invalid payment response - missing client secret");
  }

  return {
    clientSecret: data.clientSecret,
    type: data.type || "payment_intent",
    pledgeId: existingPledgeId,
    paymentMethod: data.paymentMethod || "STRIPE",
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
  type?: string;
}> {
  const addonsWithQuantity = Object.entries(selectedAddons).map(([id, quantity]) => ({
    id,
    quantity,
  }));

  const response = await fetch("/api/pledges", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
    body: JSON.stringify({
      projectId,
      rewardId,
      addons: addonsWithQuantity,
      amount: total,
      shippingAmount: totalShipping,
      shippingCountry,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to create pledge");
  }

  return {
    pledgeId: data.pledgeId,
    paymentMethod: data.paymentMethod,
    clientSecret: data.clientSecret,
    type: data.type,
  };
}

// Confirm payment after success
export async function confirmPayment(pledgeId: string, isAddItemsMode: boolean): Promise<void> {
  const endpoint = isAddItemsMode
    ? `/api/pledges/${pledgeId}/confirm-add-items`
    : `/api/pledges/${pledgeId}/confirm`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { ...getCSRFHeaders() },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to confirm payment");
  }
}
