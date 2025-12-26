/**
 * DivinityCoin Redemption Bonus System
 *
 * Backers earn achievement badges that provide redemption bonuses:
 * - Each badge provides 0.05% bonus on DivinityCoin redemptions
 * - Maximum bonus is capped at 0.03% on a rolling monthly basis
 *
 * Uses Decimal for financial precision.
 */

import { Decimal } from "@prisma/client/runtime/library";
import { db } from "@/lib/db";

// Constants for bonus calculation
const BONUS_PER_BADGE = new Decimal("0.0005"); // 0.05%
const MONTHLY_CAP = new Decimal("0.0003"); // 0.03%

/**
 * Get the start of the current month for ledger tracking
 */
function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Calculate the raw bonus percentage based on user's badges
 */
export async function calculateRawBonusPercent(userId: string): Promise<Decimal> {
  const badgeCount = await db.userAchievement.count({
    where: { userId },
  });

  // Each badge gives 0.05% bonus
  return BONUS_PER_BADGE.mul(badgeCount);
}

/**
 * Get or create the monthly bonus ledger for a user
 */
export async function getOrCreateMonthlyLedger(userId: string) {
  const month = getMonthStart();

  // Try to find existing ledger
  let ledger = await db.redemptionBonusLedger.findUnique({
    where: {
      userId_month: {
        userId,
        month,
      },
    },
  });

  if (!ledger) {
    // Calculate raw bonus from badges
    const rawBonusPercent = await calculateRawBonusPercent(userId);

    ledger = await db.redemptionBonusLedger.create({
      data: {
        userId,
        month,
        rawBonusPercent,
        appliedBonusPercent: new Decimal(0),
        totalBonusApplied: new Decimal(0),
      },
    });
  }

  return ledger;
}

/**
 * Calculate the available bonus percentage for this month
 * Takes into account the monthly cap
 */
export async function getAvailableBonusPercent(userId: string): Promise<{
  rawPercent: Decimal;
  availablePercent: Decimal;
  appliedThisMonth: Decimal;
  remainingCap: Decimal;
}> {
  const ledger = await getOrCreateMonthlyLedger(userId);

  const rawPercent = new Decimal(ledger.rawBonusPercent.toString());
  const appliedThisMonth = new Decimal(ledger.appliedBonusPercent.toString());

  // Calculate remaining cap
  const remainingCap = MONTHLY_CAP.minus(appliedThisMonth);

  // Available is the minimum of raw bonus and remaining cap
  const availablePercent = rawPercent.gt(remainingCap) ? remainingCap : rawPercent;

  return {
    rawPercent,
    availablePercent: availablePercent.gt(0) ? availablePercent : new Decimal(0),
    appliedThisMonth,
    remainingCap: remainingCap.gt(0) ? remainingCap : new Decimal(0),
  };
}

/**
 * Apply redemption bonus to a DivinityCoin redemption
 * Returns the bonus amount saved
 */
export async function applyRedemptionBonus(
  userId: string,
  redemptionId: string,
  redemptionAmount: Decimal
): Promise<{
  bonusPercentApplied: Decimal;
  bonusAmountSaved: Decimal;
  newMonthlyTotal: Decimal;
}> {
  const { availablePercent } = await getAvailableBonusPercent(userId);

  if (availablePercent.lte(0)) {
    return {
      bonusPercentApplied: new Decimal(0),
      bonusAmountSaved: new Decimal(0),
      newMonthlyTotal: new Decimal(0),
    };
  }

  // Calculate bonus amount
  const bonusAmount = redemptionAmount.mul(availablePercent);
  const roundedBonus = new Decimal(bonusAmount.toFixed(2));

  // Get ledger to update
  const ledger = await getOrCreateMonthlyLedger(userId);

  // Update ledger with applied bonus
  const updatedLedger = await db.redemptionBonusLedger.update({
    where: { id: ledger.id },
    data: {
      appliedBonusPercent: {
        increment: availablePercent,
      },
      totalBonusApplied: {
        increment: roundedBonus,
      },
    },
  });

  // Create application record
  await db.redemptionBonusApplication.create({
    data: {
      userId,
      redemptionId,
      bonusLedgerId: ledger.id,
      bonusPercentApplied: availablePercent,
      bonusAmountSaved: roundedBonus,
    },
  });

  return {
    bonusPercentApplied: availablePercent,
    bonusAmountSaved: roundedBonus,
    newMonthlyTotal: new Decimal(updatedLedger.appliedBonusPercent.toString()),
  };
}

/**
 * Get user's badge summary for display
 */
export async function getUserBadgeSummary(userId: string): Promise<{
  badgeCount: number;
  badges: Array<{
    type: string;
    earnedAt: Date;
  }>;
  rawBonusPercent: string;
  monthlyStats: {
    appliedThisMonth: string;
    remainingCap: string;
    totalSavedThisMonth: string;
  };
}> {
  const badges = await db.userAchievement.findMany({
    where: { userId },
    select: {
      badgeType: true,
      earnedAt: true,
    },
    orderBy: { earnedAt: "desc" },
  });

  const { rawPercent, appliedThisMonth, remainingCap } = await getAvailableBonusPercent(userId);

  const ledger = await getOrCreateMonthlyLedger(userId);

  return {
    badgeCount: badges.length,
    badges: badges.map((b) => ({
      type: b.badgeType,
      earnedAt: b.earnedAt,
    })),
    rawBonusPercent: `${rawPercent.mul(100).toFixed(2)}%`,
    monthlyStats: {
      appliedThisMonth: `${appliedThisMonth.mul(100).toFixed(3)}%`,
      remainingCap: `${remainingCap.mul(100).toFixed(3)}%`,
      totalSavedThisMonth: `$${Number(ledger.totalBonusApplied).toFixed(2)}`,
    },
  };
}

/**
 * Award a badge to a user (checks for duplicates)
 */
export async function awardBadge(
  userId: string,
  badgeType: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  try {
    await db.userAchievement.create({
      data: {
        userId,
        badgeType: badgeType as never,
        metadata: metadata || {},
      },
    });

    // Update the current month's ledger with new raw bonus percent
    const rawBonusPercent = await calculateRawBonusPercent(userId);
    const month = getMonthStart();

    await db.redemptionBonusLedger.upsert({
      where: {
        userId_month: { userId, month },
      },
      update: {
        rawBonusPercent,
      },
      create: {
        userId,
        month,
        rawBonusPercent,
        appliedBonusPercent: new Decimal(0),
        totalBonusApplied: new Decimal(0),
      },
    });

    return true;
  } catch (error) {
    // Duplicate badge or other error
    console.error("Error awarding badge:", error);
    return false;
  }
}

/**
 * Check and award automatic badges based on user activity
 */
export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  const awardedBadges: string[] = [];

  // Get user's pledge count
  const pledgeCount = await db.pledge.count({
    where: {
      userId,
      status: "COMPLETED",
    },
  });

  // First pledge badge
  if (pledgeCount >= 1) {
    const awarded = await awardBadge(userId, "FIRST_PLEDGE");
    if (awarded) awardedBadges.push("FIRST_PLEDGE");
  }

  // Super backer badges
  if (pledgeCount >= 10) {
    const awarded = await awardBadge(userId, "SUPER_BACKER_10");
    if (awarded) awardedBadges.push("SUPER_BACKER_10");
  }

  if (pledgeCount >= 25) {
    const awarded = await awardBadge(userId, "SUPER_BACKER_25");
    if (awarded) awardedBadges.push("SUPER_BACKER_25");
  }

  if (pledgeCount >= 50) {
    const awarded = await awardBadge(userId, "SUPER_BACKER_50");
    if (awarded) awardedBadges.push("SUPER_BACKER_50");
  }

  // Survey completionist badge (completed all surveys)
  const pendingSurveys = await db.pledge.count({
    where: {
      userId,
      status: "COMPLETED",
      surveyCompleted: false,
      project: {
        status: { in: ["FUNDED", "DELIVERED"] },
      },
    },
  });

  if (pendingSurveys === 0 && pledgeCount > 0) {
    const awarded = await awardBadge(userId, "SURVEY_COMPLETIONIST");
    if (awarded) awardedBadges.push("SURVEY_COMPLETIONIST");
  }

  return awardedBadges;
}
