import { db } from "@/lib/db";

import { logger } from "@/lib/logger";

const paymentsStripeRewardsLogger = logger.child({ module: "payments-stripe-rewards" });


/**
 * Track email campaign conversion when a pledge is completed
 * Updates the campaign's conversion count and marks clicks as converted
 */
export async function trackCampaignConversion(pledgeId: string, sourceCampaignId: string) {
  try {
    // Update campaign conversion count
    await db.emailCampaign.update({
      where: { id: sourceCampaignId },
      data: { conversionCount: { increment: 1 } },
    });

    // Find and mark the most recent click from this campaign as converted
    // Use the pledge's user to find their click
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId , deletedAt: null },
      select: { userId: true, user: { select: { email: true } } },
    });

    if (pledge) {
      // Find the most recent unconverted click for this user/campaign
      const click = await db.emailCampaignClick.findFirst({
        where: {
          campaignId: sourceCampaignId,
          converted: false,
          OR: [
            { userId: pledge.userId },
            { email: pledge.user?.email },
          ],
        },
        orderBy: { clickedAt: "desc" },
      });

      if (click) {
        await db.emailCampaignClick.update({
          where: { id: click.id },
          data: {
            converted: true,
            convertedAt: new Date(),
            pledgeId,
          },
        });
      }
    }

    paymentsStripeRewardsLogger.info(`[Conversion] Tracked conversion for campaign ${sourceCampaignId}, pledge ${pledgeId}`);
  } catch (error) {
    // Don't fail the pledge completion if conversion tracking fails
    paymentsStripeRewardsLogger.error({ err: error }, `[Conversion] Failed to track conversion:`);
  }
}

/**
 * Atomically claim a reward slot. Returns true if successful, false if sold out.
 * Uses row-level locking to prevent overselling limited rewards.
 *
 * IMPORTANT: This should be called at payment completion time, not at checkout start.
 * If this returns false, the reward is sold out and the pledge should be handled accordingly.
 */
export async function claimRewardSlot(rewardId: string, quantity: number = 1): Promise<boolean> {
  return db.$transaction(async (tx) => {
    // Lock the reward row to prevent concurrent claims
    const rewards = await tx.$queryRaw<Array<{
      id: string;
      quantityAvailable: number | null;
      quantityClaimed: number;
    }>>`
      SELECT id, "quantityAvailable", "quantityClaimed"
      FROM "Reward"
      WHERE id = ${rewardId}
      FOR UPDATE
    `;

    const reward = rewards[0];
    if (!reward) {
      paymentsStripeRewardsLogger.warn(`[claimRewardSlot] Reward ${rewardId} not found`);
      return false;
    }

    // If unlimited (null quantityAvailable), always allow
    if (reward.quantityAvailable === null) {
      await tx.reward.update({
        where: { id: rewardId },
        data: { quantityClaimed: { increment: quantity } },
      });
      return true;
    }

    // Check if enough slots available
    const availableSlots = reward.quantityAvailable - reward.quantityClaimed;
    if (availableSlots < quantity) {
      paymentsStripeRewardsLogger.warn(`[claimRewardSlot] Reward ${rewardId} sold out: requested ${quantity}, available ${availableSlots}`);
      return false;
    }

    // Claim the slot(s)
    await tx.reward.update({
      where: { id: rewardId },
      data: { quantityClaimed: { increment: quantity } },
    });

    return true;
  });
}

/**
 * Atomically claim addon slots. Returns true if all successful, false if any sold out.
 * Uses row-level locking to prevent overselling limited addons.
 */
export async function claimAddonSlots(addons: Array<{ id: string; quantity: number }>): Promise<boolean> {
  if (addons.length === 0) return true;

  return db.$transaction(async (tx) => {
    for (const addon of addons) {
      // Lock the addon/reward row
      const rewards = await tx.$queryRaw<Array<{
        id: string;
        quantityAvailable: number | null;
        quantityClaimed: number;
      }>>`
        SELECT id, "quantityAvailable", "quantityClaimed"
        FROM "Reward"
        WHERE id = ${addon.id}
        FOR UPDATE
      `;

      const reward = rewards[0];
      if (!reward) {
        paymentsStripeRewardsLogger.warn(`[claimAddonSlots] Addon ${addon.id} not found`);
        return false;
      }

      // If unlimited, just increment
      if (reward.quantityAvailable === null) {
        await tx.reward.update({
          where: { id: addon.id },
          data: { quantityClaimed: { increment: addon.quantity } },
        });
        continue;
      }

      // Check availability
      const availableSlots = reward.quantityAvailable - reward.quantityClaimed;
      if (availableSlots < addon.quantity) {
        paymentsStripeRewardsLogger.warn(`[claimAddonSlots] Addon ${addon.id} sold out: requested ${addon.quantity}, available ${availableSlots}`);
        return false;
      }

      // Claim the slots
      await tx.reward.update({
        where: { id: addon.id },
        data: { quantityClaimed: { increment: addon.quantity } },
      });
    }

    return true;
  });
}

/**
 * Atomically assign the next backer number for a project.
 * Uses a transaction with row-level locking to prevent race conditions.
 * Returns the assigned backer number.
 */
export async function assignBackerNumber(projectId: string, pledgeId: string): Promise<number> {
  return db.$transaction(async (tx) => {
    // Lock the project row to prevent concurrent backer number assignments
    // Using raw SQL for SELECT FOR UPDATE since Prisma doesn't support it directly
    await tx.$executeRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;

    // Check if already assigned (idempotent - safe to call multiple times)
    const existing = await tx.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      select: { backerNumber: true },
    });
    if (existing?.backerNumber) {
      return existing.backerNumber;
    }

    // Count existing backers with assigned numbers
    const existingBackerCount = await tx.pledge.count({
      where: {
        projectId,
        backerNumber: { not: null },
      },
    });

    const backerNumber = existingBackerCount + 1;

    // Update the pledge with the backer number within the same transaction
    await tx.pledge.update({
      where: { id: pledgeId },
      data: { backerNumber },
    });

    return backerNumber;
  });
}
