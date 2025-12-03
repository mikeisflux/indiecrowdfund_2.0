"use server";

import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";

export interface PlatformStats {
  totalPledged: number;
  projectsFunded: number;
  totalBackers: number;
  successRate: number;
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
  totalBackers: 0,
  successRate: 0,
};

const DEFAULT_RETAILER_STATS: RetailerStats = {
  certifiedRetailers: 0,
  retailerOrdersTotal: 0,
  productsAvailable: 0,
  satisfactionRate: 98,
};

// Note: formatCurrency and formatNumber are in ./utils.ts (not 'use server')

/**
 * Fetch platform-wide statistics for the home page
 * Cached for 5 minutes to reduce database load
 */
async function fetchPlatformStatsUncached(): Promise<PlatformStats> {
  try {
    // Check if db is available (it returns empty object during build)
    if (!db.pledge || typeof db.pledge.aggregate !== 'function') {
      return DEFAULT_PLATFORM_STATS;
    }

    // Get total pledged amount from completed pledges
    const pledgeStats = await db.pledge.aggregate({
      where: {
        status: "COMPLETED",
      },
      _sum: {
        amount: true,
      },
    });

    // Get count of funded projects
    const fundedProjects = await db.project.count({
      where: {
        status: "FUNDED",
      },
    });

    // Get unique backers count (users who have made at least one completed pledge)
    const uniqueBackers = await db.pledge.groupBy({
      by: ["userId"],
      where: {
        status: "COMPLETED",
      },
    });

    // Calculate success rate (funded / (funded + failed))
    const failedProjects = await db.project.count({
      where: {
        status: "FAILED",
      },
    });

    const totalCompleted = fundedProjects + failedProjects;
    const successRate = totalCompleted > 0
      ? Math.round((fundedProjects / totalCompleted) * 100)
      : 0;

    return {
      totalPledged: pledgeStats._sum.amount || 0,
      projectsFunded: fundedProjects,
      totalBackers: uniqueBackers.length,
      successRate,
    };
  } catch (error) {
    console.error("Error fetching platform stats:", error);
    return DEFAULT_PLATFORM_STATS;
  }
}

/**
 * Cached version of platform stats - revalidates every 5 minutes
 */
export const getPlatformStats = unstable_cache(
  fetchPlatformStatsUncached,
  ["platform-stats"],
  { revalidate: 300 } // 5 minutes
);

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

    // Get total retailer order value (from paid retailer pledges)
    const retailerOrders = await db.retailerPledge.aggregate({
      where: {
        status: {
          in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"],
        },
      },
      _sum: {
        totalAmount: true,
      },
    });

    // Get count of products available to retailers
    // (rewards from live projects that allow retailer pledges)
    const productsAvailable = await db.reward.count({
      where: {
        type: "TIER",
        project: {
          status: "LIVE",
          allowRetailerPledges: true,
        },
      },
    });

    // Satisfaction rate - this would typically come from a survey system
    // For now, we'll calculate based on successful deliveries vs issues
    const deliveredOrders = await db.retailerPledge.count({
      where: {
        status: "DELIVERED",
      },
    });

    const problemOrders = await db.retailerPledge.count({
      where: {
        status: {
          in: ["CANCELLED", "REFUNDED"],
        },
      },
    });

    const totalProcessedOrders = deliveredOrders + problemOrders;
    const satisfactionRate = totalProcessedOrders > 0
      ? Math.round((deliveredOrders / totalProcessedOrders) * 100)
      : 98; // Default to 98% if no data

    return {
      certifiedRetailers,
      retailerOrdersTotal: retailerOrders._sum.totalAmount || 0,
      productsAvailable,
      satisfactionRate,
    };
  } catch (error) {
    console.error("Error fetching retailer stats:", error);
    return DEFAULT_RETAILER_STATS;
  }
}

/**
 * Cached version of retailer stats - revalidates every 5 minutes
 */
export const getRetailerStats = unstable_cache(
  fetchRetailerStatsUncached,
  ["retailer-stats"],
  { revalidate: 300 } // 5 minutes
);
