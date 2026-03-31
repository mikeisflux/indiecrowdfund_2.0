import { db } from "@/lib/db";
import { getPayPalConfig, getPayPalAccessToken } from "./config";
import { logger } from "@/lib/logger";

const paypalCheckoutLogger = logger.child({ module: "paypal-checkout" });

interface AddonWithQuantity {
  id: string;
  quantity: number;
}

interface CreatePayPalPaymentParams {
  projectId: string;
  rewardId: string | null | undefined;
  addons: AddonWithQuantity[];
  amount: number;
  userId: string;
  sourceCampaignId?: string;
  shippingAmount?: number;
}

/**
 * Creates a PayPal order and a pending pledge.
 * PayPal payments are always captured immediately (no "save for later").
 */
export async function createPayPalPayment({
  projectId,
  rewardId,
  addons,
  amount,
  userId,
  sourceCampaignId,
  shippingAmount = 0,
}: CreatePayPalPaymentParams) {
  const config = await getPayPalConfig();

  const project = await db.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: { id: true, title: true },
  });

  if (!project) throw new Error("Project not found");

  const normalizedRewardId = rewardId && rewardId !== "no-reward" ? rewardId : null;

  // Calculate reward amount
  let rewardAmount = 0;
  if (normalizedRewardId) {
    const reward = await db.reward.findUnique({
      where: { id: normalizedRewardId },
      select: { amount: true },
    });
    rewardAmount = reward ? Number(reward.amount) : 0;
  }

  // Calculate addons amount
  let addonsAmount = 0;
  const addonPriceMap = new Map<string, number>();
  if (addons.length > 0) {
    const addonRecords = await db.reward.findMany({
      where: { id: { in: addons.map(a => a.id) }, type: "ADDON" },
      select: { id: true, amount: true },
    });
    addonRecords.forEach(a => addonPriceMap.set(a.id, Number(a.amount)));
    addonsAmount = addons.reduce((sum, addon) => {
      return sum + (addonPriceMap.get(addon.id) || 0) * addon.quantity;
    }, 0);
  }

  // Block if user already has a completed pledge
  const existingCompleted = await db.pledge.findFirst({
    where: { userId, projectId, status: "COMPLETED" },
  });
  if (existingCompleted) {
    throw new Error("You have already backed this project. Visit your backer dashboard to manage your pledge.");
  }

  // Cancel any stale pending PayPal pledges
  const stalePending = await db.pledge.findMany({
    where: {
      userId,
      projectId,
      paymentProcessor: "PAYPAL",
      status: "PENDING",
    },
    select: { id: true },
  });
  if (stalePending.length > 0) {
    const ids = stalePending.map(p => p.id);
    await db.pledgeAddon.deleteMany({ where: { pledgeId: { in: ids } } });
    await db.pledge.deleteMany({ where: { id: { in: ids } } });
  }

  // Create pending pledge
  const pledge = await db.pledge.create({
    data: {
      userId,
      projectId,
      rewardId: normalizedRewardId,
      amount,
      rewardAmount,
      addonsAmount,
      shippingAmount,
      paymentProcessor: "PAYPAL",
      status: "PENDING",
      chargedImmediately: true,
      ...(sourceCampaignId ? { sourceCampaignId } : {}),
    },
  });

  if (addons.length > 0) {
    await db.pledgeAddon.createMany({
      data: addons.map(addon => ({
        pledgeId: pledge.id,
        addonId: addon.id,
        quantity: addon.quantity,
        amount: (addonPriceMap.get(addon.id) || 0) * addon.quantity,
      })),
    });
  }

  // Create PayPal order
  const accessToken = await getPayPalAccessToken();
  const amountStr = amount.toFixed(2);

  const orderPayload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        custom_id: pledge.id,
        description: `Pledge for "${project.title}"`,
        amount: {
          currency_code: "USD",
          value: amountStr,
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          user_action: "PAY_NOW",
        },
      },
    },
  };

  const orderRes = await fetch(`${config.baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": pledge.id,
    },
    body: JSON.stringify(orderPayload),
  });

  if (!orderRes.ok) {
    const errBody = await orderRes.text();
    paypalCheckoutLogger.error({ pledgeId: pledge.id, err: errBody }, "PayPal order creation failed");
    // Clean up the pledge we just created
    await db.pledgeAddon.deleteMany({ where: { pledgeId: pledge.id } });
    await db.pledge.delete({ where: { id: pledge.id } });
    throw new Error("Failed to create PayPal order");
  }

  const order = await orderRes.json();
  const paypalOrderId: string = order.id;

  // Save PayPal order ID to pledge
  await db.pledge.update({
    where: { id: pledge.id },
    data: { paypalOrderId },
  });

  paypalCheckoutLogger.info({ pledgeId: pledge.id, paypalOrderId }, "PayPal order created");

  return {
    paypalOrderId,
    pledgeId: pledge.id,
  };
}
