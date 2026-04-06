import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const backerAnalyticsLogger = logger.child({ module: "backer-analytics" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET: Get spending analytics for the backer
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "all";

    // Calculate date filter based on range
    let dateFilter: Date | undefined;
    const now = new Date();
    switch (range) {
      case "year":
        dateFilter = new Date(now.getFullYear(), 0, 1);
        break;
      case "6months":
        dateFilter = new Date(now.setMonth(now.getMonth() - 6));
        break;
      case "3months":
        dateFilter = new Date(now.setMonth(now.getMonth() - 3));
        break;
      default:
        dateFilter = undefined;
    }

    // Get all completed pledges
    const pledges = await db.pledge.findMany({
      where: {
        userId: session.user.id,
        status: "COMPLETED",
        deletedAt: null,
        ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            category: true,
            status: true,
          },
        },
        reward: {
          select: {
            id: true,
            title: true,
            estimatedDelivery: true,
          },
        },
        addons: {
          select: {
            amount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate totals
    let totalSpent = 0;
    let physicalRewards = 0;
    let digitalOnly = 0;
    let addons = 0;
    let shipping = 0;

    const categoryMap: Record<string, { amount: number; count: number }> = {};
    const monthlyMap: Record<string, number> = {};

    pledges.forEach((pledge) => {
      const amount = Number(pledge.amount);
      totalSpent += amount;

      // Estimate physical vs digital based on shipping
      const shippingAmount = Number(pledge.shippingAmount || 0);
      shipping += shippingAmount;
      if (shippingAmount > 0) {
        physicalRewards += amount - shippingAmount;
      } else {
        digitalOnly += amount;
      }

      // Add-ons
      pledge.addons.forEach((addon: { amount: number | null }) => {
        addons += Number(addon.amount || 0);
      });

      // Category breakdown
      const category = pledge.project.category || "Other";
      if (!categoryMap[category]) {
        categoryMap[category] = { amount: 0, count: 0 };
      }
      categoryMap[category].amount += amount;
      categoryMap[category].count += 1;

      // Monthly breakdown
      const month = pledge.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyMap[month]) {
        monthlyMap[month] = 0;
      }
      monthlyMap[month] += amount;
    });

    // Format category breakdown
    const categoryBreakdown = Object.entries(categoryMap)
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    // Format monthly spending (last 12 months)
    const monthlySpending: { month: string; amount: number }[] = [];
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 11);
    for (let i = 0; i < 12; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      const monthKey = date.toISOString().slice(0, 7);
      const monthLabel = date.toLocaleDateString("en-US", { month: "short" });
      monthlySpending.push({
        month: monthLabel,
        amount: monthlyMap[monthKey] || 0,
      });
    }

    // Calculate success rate
    const backed = pledges.length;
    const funded = pledges.filter((p) =>
      ["FUNDED", "COMPLETED", "DELIVERED"].includes(p.project.status)
    ).length;
    const failed = backed - funded;

    // Calculate average delivery time (in months)
    let totalDeliveryMonths = 0;
    let deliveredCount = 0;
    pledges.forEach((pledge) => {
      if (pledge.fulfillmentStatus === "DELIVERED" && pledge.reward?.estimatedDelivery) {
        const pledgeDate = new Date(pledge.createdAt);
        const estimatedDate = new Date(pledge.reward.estimatedDelivery);
        const months = Math.round(
          (estimatedDate.getTime() - pledgeDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        if (months > 0) {
          totalDeliveryMonths += months;
          deliveredCount++;
        }
      }
    });
    const avgDeliveryTime = deliveredCount > 0 ? Math.round(totalDeliveryMonths / deliveredCount) : 6;

    // Projects by status
    const statusMap: Record<string, number> = {};
    pledges.forEach((pledge) => {
      const status = pledge.project.status;
      statusMap[status] = (statusMap[status] || 0) + 1;
    });
    const projectsByStatus = Object.entries(statusMap).map(([status, count]) => ({
      status,
      count,
    }));

    return NextResponse.json(
      {
        totalSpent,
        physicalRewards,
        digitalOnly,
        addons,
        shipping,
        monthlySpending,
        categoryBreakdown,
        yearlyComparison: [],
        successRate: { backed, funded, failed },
        avgDeliveryTime,
        projectsByStatus,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    backerAnalyticsLogger.error({ err: String(error) }, "Error fetching analytics:");
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500, headers: corsHeaders }
    );
  }
}
