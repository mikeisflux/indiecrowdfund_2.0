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

    // Get ALL transaction history from DivinityCoinTransaction model
    // No limit - show complete accounting history
    const transactions = await db.divinityCoinTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
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

    // Also get redemptions from the DivinityCoinRedemption table
    // These might exist without corresponding transaction records (historical data)
    const redemptions = await db.divinityCoinRedemption.findMany({
      where: { userId: session.user.id },
      orderBy: { redeemedAt: "desc" },
    });

    // Find redemptions that don't have a corresponding transaction record
    // (check by matching amount and approximate time)
    const existingRedemptionTimes = new Set(
      transactions
        .filter(tx => tx.type === "REDEMPTION")
        .map(tx => tx.createdAt.getTime())
    );

    const orphanedRedemptions = redemptions.filter(r => {
      // Check if there's a transaction within 60 seconds of this redemption
      const redemptionTime = r.redeemedAt.getTime();
      for (const txTime of existingRedemptionTimes) {
        if (Math.abs(txTime - redemptionTime) < 60000) {
          return false; // Has matching transaction
        }
      }
      return true; // No matching transaction found
    });

    // Convert orphaned redemptions to transaction format
    const redemptionTransactions = orphanedRedemptions.map(r => ({
      id: `redemption-${r.id}`,
      userId: r.userId,
      pledgeId: null,
      amount: r.amount,
      type: "REDEMPTION" as const,
      description: `Gift card redeemed (${r.code.substring(0, 4)}****)`,
      metadata: JSON.stringify({
        codePrefix: r.code.substring(0, 4),
        source: "DivinityCoinRedemption"
      }),
      createdAt: r.redeemedAt,
      pledge: null,
    }));

    // Merge and sort all transactions by date (newest first)
    const allTransactions = [...transactions, ...redemptionTransactions].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    // Calculate lifetime stats from all transactions
    let lifetimeEarned = 0;
    let lifetimeSpent = 0;

    type TransactionType = typeof allTransactions[number];

    allTransactions.forEach((tx: TransactionType) => {
      const amount = Number(tx.amount);
      if (amount > 0) {
        lifetimeEarned += amount;
      } else {
        lifetimeSpent += Math.abs(amount);
      }
    });

    // Format transactions for frontend with running balance
    // Sort oldest first to calculate running balance, then reverse
    const sortedForBalance = [...allTransactions].reverse();
    let runningBalance = Number(user.divinityCoinBalance || 0);

    // Calculate what the balance was before all these transactions
    sortedForBalance.forEach((tx) => {
      runningBalance -= Number(tx.amount);
    });

    // If there's an unaccounted starting balance, add an "Opening Balance" transaction
    const openingBalance = runningBalance;
    if (openingBalance !== 0) {
      // Add opening balance as the first (oldest) transaction
      const oldestDate = sortedForBalance.length > 0
        ? new Date(sortedForBalance[0].createdAt.getTime() - 1000) // 1 second before oldest
        : new Date(user.createdAt);

      sortedForBalance.unshift({
        id: "opening-balance",
        userId: session.user.id,
        pledgeId: null,
        amount: { toNumber: () => openingBalance } as unknown as typeof sortedForBalance[0]["amount"],
        type: "INITIAL" as unknown as typeof sortedForBalance[0]["type"],
        description: "Opening balance",
        metadata: null,
        createdAt: oldestDate,
        pledge: null,
      } as typeof sortedForBalance[0]);
    }

    // Reset and recalculate running balance
    runningBalance = 0;

    // Now process in chronological order to build running balances
    const transactionsWithBalance = sortedForBalance.map((tx) => {
      runningBalance += Number(tx.amount);
      return { ...tx, balanceAfter: runningBalance };
    });

    // Reverse back to newest first
    transactionsWithBalance.reverse();

    const formattedTransactions = transactionsWithBalance.map((tx) => {
      const amount = Number(tx.amount);
      let type: "EARNED" | "SPENT" | "REDEEMED" | "BONUS" | "REFERRAL" | "REFUND" | "INITIAL" = "EARNED";

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
        case "INITIAL":
          type = "INITIAL";
          break;
        default:
          type = amount >= 0 ? "EARNED" : "SPENT";
      }

      // Parse metadata to extract code suffix for redemptions
      let parsedMetadata;
      try {
        parsedMetadata = tx.metadata ? JSON.parse(tx.metadata as string) : undefined;
      } catch {
        parsedMetadata = undefined;
      }

      // Build description - preserve original for historical transactions
      let description = tx.description || `${type} transaction`;

      // For redemptions, try to extract code info from metadata if available
      if (type === "REDEEMED") {
        if (parsedMetadata?.codeSuffix) {
          description = `Gift card redeemed ****${parsedMetadata.codeSuffix}`;
        } else if (parsedMetadata?.codePrefix) {
          // Fallback for older redemptions that only have prefix
          description = `Gift card redeemed ${parsedMetadata.codePrefix}****`;
        }
        // Otherwise keep original description from database
      }

      return {
        id: tx.id,
        type,
        amount: Math.abs(amount),
        description,
        projectTitle: tx.pledge?.project?.title || undefined,
        createdAt: tx.createdAt.toISOString(),
        balanceAfter: tx.balanceAfter,
        metadata: parsedMetadata,
      };
    });

    // Get user's badge count for bonus calculation
    const badgeCount = await db.userAchievement.count({
      where: { userId: session.user.id },
    });

    // Calculate bonus rate (0.5% per badge, capped at 3%)
    const rawBonusPercent = Math.min(badgeCount * 0.5, 3); // Cap at 3%
    const monthlyCap = 3; // 3% monthly cap
    const appliedThisMonth = Math.min(rawBonusPercent, monthlyCap);

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
