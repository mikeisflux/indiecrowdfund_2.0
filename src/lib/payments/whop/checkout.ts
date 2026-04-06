import Whop from "@whop/sdk";
import { db } from "@/lib/db";
import { getWhopConfig } from "./config";
import { logger } from "@/lib/logger";

const whopCheckoutLogger = logger.child({ module: "whop-checkout" });

interface AddonWithQuantity {
  id: string;
  quantity: number;
}

interface CreateWhopPaymentParams {
  projectId: string;
  rewardId: string | null | undefined;
  addons: AddonWithQuantity[];
  amount: number;
  userId: string;
  sourceCampaignId?: string;
  shippingAmount?: number;
}

/**
 * Creates a Whop checkout configuration and a pending pledge.
 * Returns the Whop sessionId (ch_xxx) and pledgeId.
 */
export async function createWhopPayment({
  projectId,
  rewardId,
  addons,
  amount,
  userId,
  sourceCampaignId,
  shippingAmount = 0,
}: CreateWhopPaymentParams) {
  const config = await getWhopConfig();

  const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null },
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
    where: { userId, projectId, deletedAt: null, status: "COMPLETED" },
  });
  if (existingCompleted) {
    throw new Error("You have already backed this project. Visit your backer dashboard to manage your pledge.");
  }

  // Cancel any stale pending Whop pledges for this user+project
  const stalePending = await db.pledge.findMany({
    where: {
      userId,
      projectId,
      paymentProcessor: "WHOP",
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
      paymentProcessor: "WHOP",
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

  // Create Whop checkout configuration
  const client = new Whop({ apiKey: config.apiKey });

  const checkoutConfig = await client.checkoutConfigurations.create({
    plan: {
      company_id: config.companyId,
      currency: "usd",
      initial_price: amount,
      plan_type: "one_time",
      release_method: "buy_now",
    },
    metadata: {
      pledgeId: pledge.id,
      projectId,
      userId,
    },
  });

  const sessionId = checkoutConfig.id;

  // Save Whop session ID to pledge
  await db.pledge.update({
    where: { id: pledge.id },
    data: { whopCheckoutId: sessionId },
  });

  whopCheckoutLogger.info({ pledgeId: pledge.id, sessionId }, "Whop checkout configuration created");

  return {
    sessionId,
    pledgeId: pledge.id,
  };
}
