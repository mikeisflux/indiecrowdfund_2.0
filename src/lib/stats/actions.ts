"use server";

import { db } from "@/lib/db";

export interface PlatformStats {
  totalPledged: number;
  projectsFunded: number;
  successRate: number;
  backerPool: number;
}

export interface RetailerStats {
  certifiedRetailers: number;
  retailerOrdersTotal: number;
  productsAvailable: number;
  satisfactionRate: number;
}

// Default stats returned during build time or when db is unavailable
const DEFAULT_PLATFORM_STATS: PlatformStats = {
  totalPledged: 0,
  projectsFunded: 0,
  successRate: 0,
  backerPool: 0,
};

const DEFAULT_RETAILER_STATS: RetailerStats = {
  certifiedRetailers: 0,
  retailerOrdersTotal: 0,
  productsAvailable: 0,
  satisfactionRate: 0,
};

// Note: formatCurrency and formatNumber are in ./utils.ts (not 'use server')

/**
 * Fetch platform-wide statistics for the home page
 * Cached for 5 minutes to reduce database load
 */
async function fetchPlatformStatsUncached(): Promise<PlatformStats> {
  try {
    // Check if db is available (it returns empty object during build)
    if (!db.project || typeof db.project.findMany !== 'function') {
      return DEFAULT_PLATFORM_STATS;
    }

    // Get all projects that have been LIVE, FUNDED, or FAILED
    // Exclude soft-deleted projects
    const allActiveProjects = await db.project.findMany({
      where: {
        status: {
          in: ["LIVE", "FUNDED", "FAILED"],
        },
        deletedAt: null,
      },
      select: {
        id: true,
        currentAmount: true,
        goalAmount: true,
        endDate: true,
        status: true,
      },
    });

    // Total pledged = sum of all project currentAmounts
    // This matches what project pages display and is kept in sync
    // by the auto-sync mechanism in project stats endpoints
    const totalPledged = allActiveProjects.reduce(
      (sum, p) => sum + Number(p.currentAmount),
      0
    );

    // Count projects that met their funding goal
    const projectsFundedCount = allActiveProjects.filter(
      (p) => Number(p.currentAmount) >= Number(p.goalAmount)
    ).length;

    // Calculate success rate based on ended projects
    // An "ended" project is one where endDate < now
    const now = new Date();
    const endedProjects = allActiveProjects.filter(
      (p) => p.endDate && new Date(p.endDate) < now
    );

    const successfulEndedProjects = endedProjects.filter(
      (p) => Number(p.currentAmount) >= Number(p.goalAmount)
    ).length;

    const totalEndedProjects = endedProjects.length;
    const successRate = totalEndedProjects > 0
      ? Math.round((successfulEndedProjects / totalEndedProjects) * 100)
      : 0;

    // Backer pool = total registered users (excluding deleted/locked accounts)
    const totalBackers = await db.user.count({
      where: {
        deletedAt: null,
        lockedAt: null,
      },
    });

    return {
      totalPledged,
      projectsFunded: projectsFundedCount,
      successRate,
      backerPool: totalBackers,
    };
  } catch (error) {
    console.error("Error fetching platform stats:", error);
    return DEFAULT_PLATFORM_STATS;
  }
}

/**
 * Fetch platform stats directly (no unstable_cache — it caches stale empty
 * results after deploys; the homepage is already dynamic due to auth()).
 */
export const getPlatformStats = fetchPlatformStatsUncached;

/**
 * Fetch retailer-specific statistics for the retailer page
 * Cached for 5 minutes to reduce database load
 */
async function fetchRetailerStatsUncached(): Promise<RetailerStats> {
  try {
    // Check if db is available (it returns empty object during build)
    if (!db.retailer || typeof db.retailer.count !== 'function') {
      return DEFAULT_RETAILER_STATS;
    }

    // Get count of approved/certified retailers
    const certifiedRetailers = await db.retailer.count({
      where: {
        status: "APPROVED",
      },
    });

    // Get total retailer order value (from all retailer pledges)
    const retailerOrders = await db.retailerPledge.aggregate({
      where: {
        status: {
          in: ["PENDING", "INVOICED", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"],
        },
      },
      _sum: {
        totalAmount: true,
      },
    });

    // Get count of products available - all rewards and addons from LIVE campaigns
    const productsAvailable = await db.reward.count({
      where: {
        project: {
          status: "LIVE",
        },
      },
    });

    // Satisfaction rate - from retailer satisfaction surveys after delivery
    // Count surveys with positive ratings (4-5 stars) vs total completed surveys
    let satisfactionRate = 0; // Default to 0 until we have survey data

    try {
      // Check if RetailerSatisfactionSurvey model exists
      if (db.retailerSatisfactionSurvey && typeof db.retailerSatisfactionSurvey.count === 'function') {
        const totalSurveys = await db.retailerSatisfactionSurvey.count({
          where: {
            completedAt: { not: null },
          },
        });

        if (totalSurveys > 0) {
          const positiveSurveys = await db.retailerSatisfactionSurvey.count({
            where: {
              completedAt: { not: null },
              rating: { gte: 4 }, // 4-5 star ratings are considered satisfied
            },
          });
          satisfactionRate = Math.round((positiveSurveys / totalSurveys) * 100);
        }
      }
    } catch {
      // RetailerSatisfactionSurvey model doesn't exist yet, use default
    }

    return {
      certifiedRetailers,
      retailerOrdersTotal: Number(retailerOrders._sum.totalAmount || 0),
      productsAvailable,
      satisfactionRate,
    };
  } catch (error) {
    console.error("Error fetching retailer stats:", error);
    return DEFAULT_RETAILER_STATS;
  }
}

/**
 * Fetch retailer stats directly (no unstable_cache — same reason as above).
 */
export const getRetailerStats = fetchRetailerStatsUncached;
