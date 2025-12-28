import { NextResponse } from "next/server";
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

// GET: Get user's DivinityCoin wallet data
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    // Get user with wallet balance
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        divinityCoinBalance: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: corsHeaders });
    }

    // Get transaction history from DivinityCoinTransaction model
    const transactions = await db.divinityCoinTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit to last 50 transactions
      include: {
        pledge: {
          include: {
            project: {
              select: { title: true },
            },
          },
        },
      },
    });

    // Calculate lifetime stats from transactions
    let lifetimeEarned = 0;
    let lifetimeSpent = 0;

    type TransactionType = typeof transactions[number];

    transactions.forEach((tx: TransactionType) => {
      const amount = Number(tx.amount);
      if (amount > 0) {
        lifetimeEarned += amount;
      } else {
        lifetimeSpent += Math.abs(amount);
      }
    });

    // Format transactions for frontend
    const formattedTransactions = transactions.map((tx: TransactionType) => {
      const amount = Number(tx.amount);
      let type: "EARNED" | "SPENT" | "REDEEMED" | "BONUS" | "REFERRAL" | "REFUND" = "EARNED";

      // Map transaction type
      switch (tx.type) {
        case "PAYMENT":
          type = "SPENT";
          break;
        case "REDEMPTION":
          type = "REDEEMED";
          break;
        case "BONUS":
          type = "BONUS";
          break;
        case "REFERRAL":
          type = "REFERRAL";
          break;
        case "REFUND":
          type = "REFUND";
          break;
        default:
          type = amount >= 0 ? "EARNED" : "SPENT";
      }

      return {
        id: tx.id,
        type,
        amount: Math.abs(amount),
        description: tx.description || `${type} transaction`,
        projectTitle: tx.pledge?.project?.title || undefined,
        createdAt: tx.createdAt.toISOString(),
        metadata: tx.metadata ? JSON.parse(tx.metadata as string) : undefined,
      };
    });

    // Get user's badge count for bonus calculation
    const badgeCount = await db.badge.count({
      where: { userId: session.user.id },
    });

    // Calculate bonus rate (0.05% per badge, capped at reasonable amount)
    const rawBonusPercent = Math.min(badgeCount * 0.05, 5); // Cap at 5%
    const monthlyCap = 0.03; // 0.03% monthly cap per badge
    const appliedThisMonth = Math.min(rawBonusPercent, monthlyCap * badgeCount);

    // Calculate this month's redemptions to get remaining cap
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthRedemptions = await db.divinityCoinTransaction.aggregate({
      where: {
        userId: session.user.id,
        type: "REDEMPTION",
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    const totalRedeemedThisMonth = Number(thisMonthRedemptions._sum.amount || 0);
    const bonusSavedThisMonth = totalRedeemedThisMonth * (appliedThisMonth / 100);

    return NextResponse.json({
      balance: Number(user.divinityCoinBalance || 0),
      lifetimeEarned,
      lifetimeSpent,
      pendingBonuses: 0, // Could calculate from pending stretch goals
      transactions: formattedTransactions,
      bonusSummary: {
        badgeCount,
        rawBonusPercent: `${rawBonusPercent.toFixed(2)}%`,
        appliedThisMonth: `${appliedThisMonth.toFixed(2)}%`,
        remainingCap: `$${(1000 - bonusSavedThisMonth).toFixed(2)}`, // Example monthly cap
        totalSavedThisMonth: `$${bonusSavedThisMonth.toFixed(2)}`,
      },
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error fetching wallet data:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet data" },
      { status: 500, headers: corsHeaders }
    );
  }
}
