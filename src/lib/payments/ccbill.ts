import { db } from "@/lib/db";
import crypto from "crypto";

interface CCBillPaymentParams {
  projectId: string;
  rewardId: string;
  addonIds: string[];
  amount: number;
  userId: string;
  clientAccnum: string;
  clientSubacc: string;
  formName: string;
}

interface CCBillWebhookPayload {
  eventType: "NewSaleSuccess" | "NewSaleFailure" | "Refund" | "Chargeback";
  subscriptionId: string;
  clientAccnum: string;
  clientSubacc: string;
  timestamp: string;
  transactionId: string;
  initialPrice: string;
  currencyCode: string;
  // Custom parameters
  X_pledgeId?: string;
  X_projectId?: string;
  X_userId?: string;
}

const CCBILL_FLEXFORMS_URL =
  process.env.CCBILL_FLEXFORMS_URL || "https://api.ccbill.com/wap-frontflex/flexforms";

export async function createCCBillPaymentUrl({
  projectId,
  rewardId,
  addonIds,
  amount,
  userId,
  clientAccnum,
  clientSubacc,
  formName,
}: CCBillPaymentParams): Promise<{ paymentUrl: string; pledgeId: string }> {
  // Create pending pledge
  const pledge = await db.pledge.create({
    data: {
      userId,
      projectId,
      rewardId,
      amount,
      rewardAmount: amount,
      paymentProcessor: "CCBILL",
      status: "PENDING",
    },
  });

  // Create addon records if any
  if (addonIds.length > 0) {
    // Fetch addon details to get their amounts
    const addons = await db.reward.findMany({
      where: {
        id: { in: addonIds },
        type: "ADDON",
      },
      select: { id: true, amount: true },
    });

    // Create PledgeAddon records
    await db.pledgeAddon.createMany({
      data: addons.map((addon) => ({
        pledgeId: pledge.id,
        addonId: addon.id,
        quantity: 1,
        amount: addon.amount,
      })),
    });
  }

  // Build CCBill payment URL
  const params = new URLSearchParams({
    clientAccnum,
    clientSubacc,
    formName,
    initialPrice: amount.toFixed(2),
    initialPeriod: "30", // Required for one-time payments
    currencyCode: "840", // USD
    // Pass custom data back in webhook
    "X_pledgeId": pledge.id,
    "X_projectId": projectId,
    "X_userId": userId,
  });

  const paymentUrl = `${CCBILL_FLEXFORMS_URL}/${formName}?${params.toString()}`;

  return {
    paymentUrl,
    pledgeId: pledge.id,
  };
}

export function verifyCCBillDigest(
  payload: Record<string, string>,
  receivedDigest: string,
  salt: string
): boolean {
  // CCBill uses MD5 for webhook verification
  // The digest string is formed from specific fields + salt
  const digestString = `${payload.subscriptionId}${payload.eventType}${salt}`;
  const calculatedDigest = crypto
    .createHash("md5")
    .update(digestString)
    .digest("hex");

  return calculatedDigest === receivedDigest;
}

export async function handleCCBillWebhook(
  payload: CCBillWebhookPayload
): Promise<void> {
  const pledgeId = payload.X_pledgeId;

  if (!pledgeId) {
    console.error("CCBill webhook missing pledgeId");
    return;
  }

  switch (payload.eventType) {
    case "NewSaleSuccess":
      await handleCCBillSuccess(pledgeId, payload);
      break;

    case "NewSaleFailure":
      await handleCCBillFailure(pledgeId);
      break;

    case "Refund":
      await handleCCBillRefund(pledgeId);
      break;

    case "Chargeback":
      await handleCCBillChargeback(pledgeId);
      break;
  }
}

async function handleCCBillSuccess(
  pledgeId: string,
  payload: CCBillWebhookPayload
) {
  const pledge = await db.pledge.update({
    where: { id: pledgeId },
    data: {
      status: "COMPLETED",
      ccbillTransactionId: payload.transactionId,
      ccbillSubscriptionId: payload.subscriptionId,
    },
    include: {
      project: true,
      user: true,
    },
  });

  // Update project funding
  await db.project.update({
    where: { id: pledge.projectId },
    data: {
      currentAmount: { increment: pledge.amount },
      backerCount: { increment: 1 },
    },
  });

  // Update reward quantity
  await db.reward.update({
    where: { id: pledge.rewardId },
    data: {
      quantityClaimed: { increment: 1 },
    },
  });
}

async function handleCCBillFailure(pledgeId: string) {
  await db.pledge.update({
    where: { id: pledgeId },
    data: {
      status: "FAILED",
    },
  });
}

async function handleCCBillRefund(pledgeId: string) {
  const pledge = await db.pledge.update({
    where: { id: pledgeId },
    data: {
      status: "REFUNDED",
    },
  });

  // Decrement project funding
  await db.project.update({
    where: { id: pledge.projectId },
    data: {
      currentAmount: { decrement: pledge.amount },
      backerCount: { decrement: 1 },
    },
  });

  // Restore reward quantity
  await db.reward.update({
    where: { id: pledge.rewardId },
    data: {
      quantityClaimed: { decrement: 1 },
    },
  });
}

async function handleCCBillChargeback(pledgeId: string) {
  const pledge = await db.pledge.update({
    where: { id: pledgeId },
    data: {
      status: "CHARGEBACK",
    },
  });

  // Decrement project funding
  await db.project.update({
    where: { id: pledge.projectId },
    data: {
      currentAmount: { decrement: pledge.amount },
      backerCount: { decrement: 1 },
    },
  });

  // Restore reward quantity
  await db.reward.update({
    where: { id: pledge.rewardId },
    data: {
      quantityClaimed: { decrement: 1 },
    },
  });
}

export function calculateCCBillFees(amount: number): {
  processorFee: number;
  platformFee: number;
  netAmount: number;
} {
  // CCBill typically charges ~10.5% for merchant services
  const processorRate = 0.105;
  const platformRate = 0.05;

  const processorFee = amount * processorRate;
  const platformFee = amount * platformRate;
  const netAmount = amount - processorFee - platformFee;

  return {
    processorFee: Math.round(processorFee * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
  };
}
