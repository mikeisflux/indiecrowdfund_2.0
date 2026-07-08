import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getPayPalConnectConfig, getPayPalConnectAccessToken } from "./config";

const paypalConnectCheckoutLogger = logger.child({ module: "paypal-connect-checkout" });

interface AddonWithQuantity {
  id: string;
  quantity: number;
}

interface CreatePayPalConnectPaymentParams {
  projectId: string;
  rewardId: string | null | undefined;
  addons: AddonWithQuantity[];
  amount: number;
  userId: string;
  sourceCampaignId?: string;
  shippingAmount?: number;
  shippingAddress?: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
  };
}

/**
 * Creates a PayPal Complete Payments Platform order and a pending pledge.
 *
 * Unlike standard PayPal, the order is routed to the creator's own PayPal
 * account via `purchase_units[].payee.merchant_id`, and the platform's fee is
 * taken automatically via `payment_instruction.platform_fees`. This is the
 * PayPal equivalent of a Stripe Connect destination charge with an
 * application fee.
 *
 * Mirrors the AUTHORIZE-until-funded / CAPTURE-when-funded intent logic used
 * by the standard PayPal flow.
 */
export async function createPayPalConnectPayment({
  projectId,
  rewardId,
  addons,
  amount,
  userId,
  sourceCampaignId,
  shippingAmount = 0,
  shippingAddress,
}: CreatePayPalConnectPaymentParams) {
  const config = await getPayPalConnectConfig();

  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      title: true,
      goalAmount: true,
      currentAmount: true,
      status: true,
      campaignType: true,
      creatorId: true,
    },
  });

  if (!project) throw new Error("Project not found");

  // Resolve the creator's connected PayPal merchant id + readiness.
  const connectAccount = await db.payPalConnectAccount.findUnique({
    where: { userId: project.creatorId },
    select: { merchantIdInPayPal: true, paymentsReceivable: true, onboardingStatus: true },
  });

  if (!connectAccount?.merchantIdInPayPal || !connectAccount.paymentsReceivable) {
    throw new Error("Creator has not completed PayPal Connect onboarding");
  }
  const sellerMerchantId = connectAccount.merchantIdInPayPal;

  const normalizedRewardId = rewardId && rewardId !== "no-reward" ? rewardId : null;

  // Reward amount
  let rewardAmount = 0;
  if (normalizedRewardId) {
    const reward = await db.reward.findUnique({
      where: { id: normalizedRewardId },
      select: { amount: true },
    });
    rewardAmount = reward ? Number(reward.amount) : 0;
  }

  // Addon amounts
  let addonsAmount = 0;
  const addonPriceMap = new Map<string, number>();
  if (addons.length > 0) {
    const addonRecords = await db.reward.findMany({
      where: { id: { in: addons.map((a) => a.id) }, type: "ADDON" },
      select: { id: true, amount: true },
    });
    addonRecords.forEach((a) => addonPriceMap.set(a.id, Number(a.amount)));
    addonsAmount = addons.reduce(
      (sum, addon) => sum + (addonPriceMap.get(addon.id) || 0) * addon.quantity,
      0,
    );
  }

  // Block if the user already has a completed pledge on this project.
  const existingCompleted = await db.pledge.findFirst({
    where: { userId, projectId, deletedAt: null, status: "COMPLETED" },
  });
  if (existingCompleted) {
    throw new Error(
      "You have already backed this project. Visit your backer dashboard to manage your pledge.",
    );
  }

  // Cancel stale pending PayPal Connect pledges for this user/project.
  const stalePending = await db.pledge.findMany({
    where: { userId, projectId, paymentProcessor: "PAYPAL_CONNECT", status: "PENDING" },
    select: { id: true },
  });
  if (stalePending.length > 0) {
    const ids = stalePending.map((p) => p.id);
    await db.pledgeAddon.deleteMany({ where: { pledgeId: { in: ids } } });
    await db.pledge.deleteMany({ where: { id: { in: ids } } });
  }

  // Intent: capture immediately when the campaign is already funded, otherwise
  // authorize (hold) until the goal is reached.
  const isKeepItAll = project.campaignType === "KEEP_IT_ALL";
  const isFunded =
    isKeepItAll ||
    project.status === "FUNDED" ||
    Number(project.currentAmount) >= Number(project.goalAmount);
  const paypalIntent = isFunded ? "CAPTURE" : "AUTHORIZE";

  // Platform fee (percentage from settings, default 5%).
  const settings = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: { platformFee: true },
  });
  const feePercent = settings?.platformFee ?? 5;
  const amountStr = amount.toFixed(2);
  const platformFeeStr = ((amount * feePercent) / 100).toFixed(2);

  // Create the pending pledge.
  const pledge = await db.pledge.create({
    data: {
      userId,
      projectId,
      rewardId: normalizedRewardId,
      amount,
      rewardAmount,
      addonsAmount,
      shippingAmount,
      paymentProcessor: "PAYPAL_CONNECT",
      status: "PENDING",
      chargedImmediately: isFunded,
      paypalConnectSellerMerchantId: sellerMerchantId,
      shippingAddress: shippingAddress
        ? (shippingAddress as unknown as Record<string, unknown>)
        : undefined,
      ...(sourceCampaignId ? { sourceCampaignId } : {}),
    },
  });

  if (addons.length > 0) {
    await db.pledgeAddon.createMany({
      data: addons.map((addon) => ({
        pledgeId: pledge.id,
        addonId: addon.id,
        quantity: addon.quantity,
        amount: (addonPriceMap.get(addon.id) || 0) * addon.quantity,
      })),
    });
  }

  const accessToken = await getPayPalConnectAccessToken();

  const orderPayload = {
    intent: paypalIntent,
    purchase_units: [
      {
        custom_id: pledge.id,
        description: `Pledge for "${project.title}"`,
        amount: { currency_code: "USD", value: amountStr },
        payee: { merchant_id: sellerMerchantId },
        payment_instruction: {
          disbursement_mode: "INSTANT",
          platform_fees: [
            {
              amount: { currency_code: "USD", value: platformFeeStr },
            },
          ],
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: isFunded ? "IMMEDIATE_PAYMENT_REQUIRED" : "UNRESTRICTED",
          user_action: isFunded ? "PAY_NOW" : "CONTINUE",
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
      "PayPal-Partner-Attribution-Id": config.bnCode,
    },
    body: JSON.stringify(orderPayload),
  });

  if (!orderRes.ok) {
    const errBody = await orderRes.text();
    paypalConnectCheckoutLogger.error(
      { pledgeId: pledge.id, err: errBody },
      "PayPal Connect order creation failed",
    );
    await db.pledgeAddon.deleteMany({ where: { pledgeId: pledge.id } });
    await db.pledge.deleteMany({ where: { id: pledge.id } });
    throw new Error("Failed to create PayPal Connect order");
  }

  const order = await orderRes.json();
  const paypalConnectOrderId: string = order.id;

  await db.pledge.updateMany({
    where: { id: pledge.id, deletedAt: null },
    data: { paypalConnectOrderId },
  });

  paypalConnectCheckoutLogger.info(
    { pledgeId: pledge.id, paypalConnectOrderId, sellerMerchantId },
    "PayPal Connect order created",
  );

  return {
    paypalConnectOrderId,
    pledgeId: pledge.id,
    sellerMerchantId,
  };
}
