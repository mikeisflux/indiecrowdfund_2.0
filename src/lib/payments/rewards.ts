import { db } from "@/lib/db";

import { logger } from "@/lib/logger";

const paymentsRewardsLogger = logger.child({ module: "payments-rewards" });


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

    paymentsRewardsLogger.info(`[Conversion] Tracked conversion for campaign ${sourceCampaignId}, pledge ${pledgeId}`);
  } catch (error) {
    // Don't fail the pledge completion if conversion tracking fails
    paymentsRewardsLogger.error({ err: error }, `[Conversion] Failed to track conversion:`);
  }
}

interface PoolRow {
  id: string;
  quantityAvailable: number | null;
  quantityClaimed: number;
  isEnded: boolean;
}

/**
 * Lock every reward in this one's stock pool and return them.
 *
 * A pool is defined explicitly by the creator: an add-on that is the same
 * physical thing as a tier sets sharedStockWithId to that tier, and the two
 * then draw from ONE quantity. "LTD to 10" with 4 tiers and 6 add-ons sold is
 * sold out. Without a link each reward keeps its own independent count, exactly
 * as before.
 *
 * COALESCE(sharedStockWithId, id) is the pool key, so the query resolves the
 * whole group whether you start from the tier being pointed at or from any
 * add-on pointing at it.
 *
 * Rows are locked in id order so concurrent claims on the same pool can't
 * deadlock against each other.
 */
// Minimal shape of the transactional client we need. The project's Prisma
// client is loosely typed via prisma-client-stub.d.ts, so spelling out just
// $queryRaw here keeps this function checkable without importing Prisma types.
interface TxLike {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

async function lockPool(tx: TxLike, rewardId: string): Promise<PoolRow[]> {
  return tx.$queryRaw<PoolRow[]>`
    SELECT r.id, r."quantityAvailable", r."quantityClaimed", r."isEnded"
    FROM "Reward" r
    WHERE COALESCE(r."sharedStockWithId", r.id) = (
      SELECT COALESCE("sharedStockWithId", id) FROM "Reward" WHERE id = ${rewardId}
    )
    ORDER BY r.id
    FOR UPDATE
  `;
}

/**
 * Remaining stock for a locked pool, or null when the pool is unlimited.
 * The cap is the smallest limit any member declares — if one row says 10 and
 * another says 25, honouring 10 is the safe reading. Claims from every member
 * count against it.
 */
function poolRemaining(pool: PoolRow[]): number | null {
  const limits = pool
    .map((r) => r.quantityAvailable)
    .filter((q): q is number => q !== null);
  if (limits.length === 0) return null;
  const cap = Math.min(...limits);
  const claimed = pool.reduce((sum, r) => sum + r.quantityClaimed, 0);
  return cap - claimed;
}

/**
 * Remaining stock for a reward, counting its whole shared-stock pool.
 * Returns null when unlimited. Read-only — no locking — for pre-checks and
 * display; the authoritative check is inside claimRewardSlot / claimAddonSlots.
 */
export async function getPoolRemaining(rewardId: string): Promise<number | null> {
  const pool = await db.$queryRaw<PoolRow[]>`
    SELECT r.id, r."quantityAvailable", r."quantityClaimed", r."isEnded"
    FROM "Reward" r
    WHERE COALESCE(r."sharedStockWithId", r.id) = (
      SELECT COALESCE("sharedStockWithId", id) FROM "Reward" WHERE id = ${rewardId}
    )
  `;
  return poolRemaining(pool);
}

/** Convenience wrapper: true when a reward's pool has nothing left. */
export async function isPoolSoldOut(rewardId: string): Promise<boolean> {
  const remaining = await getPoolRemaining(rewardId);
  return remaining !== null && remaining <= 0;
}

/**
 * Atomically claim a reward slot. Returns true if successful, false if sold out.
 * Uses row-level locking to prevent overselling limited rewards.
 *
 * Stock is shared across every reward/add-on in the project with the same
 * title — see lockPool above.
 *
 * IMPORTANT: This should be called at payment completion time, not at checkout start.
 * If this returns false, the reward is sold out and the pledge should be handled accordingly.
 */
export async function claimRewardSlot(rewardId: string, quantity: number = 1): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const pool = await lockPool(tx, rewardId);
    const reward = pool.find((r) => r.id === rewardId);
    if (!reward) {
      paymentsRewardsLogger.warn(`[claimRewardSlot] Reward ${rewardId} not found`);
      return false;
    }

    // Reject if reward was ended between initial check and slot claim
    if (reward.isEnded) {
      paymentsRewardsLogger.warn(`[claimRewardSlot] Reward ${rewardId} has been ended`);
      return false;
    }

    const remaining = poolRemaining(pool);

    // Unlimited pool — nothing to check.
    if (remaining === null) {
      await tx.reward.update({
        where: { id: rewardId },
        data: { quantityClaimed: { increment: quantity } },
      });
      return true;
    }

    if (remaining < quantity) {
      paymentsRewardsLogger.warn(
        `[claimRewardSlot] Reward ${rewardId} sold out: requested ${quantity}, available ${remaining} across ${pool.length} pooled reward(s)`
      );
      return false;
    }

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
      // Lock the whole shared-stock pool, not just this row, so an add-on
      // linked to a tier can't sell past the tier's limit.
      const pool = await lockPool(tx, addon.id);
      const reward = pool.find((r) => r.id === addon.id);
      if (!reward) {
        paymentsRewardsLogger.warn(`[claimAddonSlots] Addon ${addon.id} not found`);
        return false;
      }

      const remaining = poolRemaining(pool);

      // If unlimited, just increment
      if (remaining === null) {
        await tx.reward.update({
          where: { id: addon.id },
          data: { quantityClaimed: { increment: addon.quantity } },
        });
        continue;
      }

      if (remaining < addon.quantity) {
        paymentsRewardsLogger.warn(
          `[claimAddonSlots] Addon ${addon.id} sold out: requested ${addon.quantity}, available ${remaining} across ${pool.length} pooled reward(s)`
        );
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
        NOT: { backerNumber: null },
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
