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
  nmiPublicKey?: string;
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
    nmiPublicKey: data.nmiPublicKey,
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
  whopSessionId?: string;
  // PaymentCloud (NMI) — public tokenization key for Collect.js
  publicKey?: string;
  isKeepItAll?: boolean;
}> {
  const addonsWithQuantity = Object.entries(selectedAddons).map(([id, quantity]) => ({
    id,
    quantity,
  }));

  const response = await apiFetch("/api/pledges", {
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
  });

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
    publicKey: data.publicKey,
    isKeepItAll: data.isKeepItAll,
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
