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

    // Get user with wallet data
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        divinityCoins: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: corsHeaders });
    }

    // Get all pledges to calculate bonuses earned
    const pledges = await db.pledge.findMany({
      where: {
        userId: session.user.id,
        status: "COMPLETED",
      },
      include: {
        project: {
          select: {
            title: true,
            slug: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate wallet statistics
    const totalEarned = pledges.reduce((sum, p) => sum + Number(p.bonusAmount || 0), 0);
    const totalSpent = pledges.reduce((sum, p) => sum + Number(p.coinsUsed || 0), 0);

    // Build transaction history from pledges
    const transactions = pledges.flatMap((pledge) => {
      const txns = [];

      // Bonus earned transaction
      if (Number(pledge.bonusAmount || 0) > 0) {
        txns.push({
          id: `${pledge.id}-bonus`,
          type: "earned",
          amount: Number(pledge.bonusAmount),
          description: `Bonus from backing ${pledge.project.title}`,
          projectTitle: pledge.project.title,
          projectSlug: pledge.project.slug,
          projectImage: pledge.project.imageUrl,
          createdAt: pledge.createdAt,
        });
      }

      // Coins spent transaction
      if (Number(pledge.coinsUsed || 0) > 0) {
        txns.push({
          id: `${pledge.id}-spent`,
          type: "spent",
          amount: Number(pledge.coinsUsed),
          description: `Applied to ${pledge.project.title}`,
          projectTitle: pledge.project.title,
          projectSlug: pledge.project.slug,
          projectImage: pledge.project.imageUrl,
          createdAt: pledge.createdAt,
        });
      }

      return txns;
    });

    // Sort transactions by date
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate monthly earning trends (last 6 months)
    const now = new Date();
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthPledges = pledges.filter((p) => {
        const date = new Date(p.createdAt);
        return date >= monthStart && date <= monthEnd;
      });

      const earned = monthPledges.reduce((sum, p) => sum + Number(p.bonusAmount || 0), 0);
      const spent = monthPledges.reduce((sum, p) => sum + Number(p.coinsUsed || 0), 0);

      monthlyData.push({
        month: monthStart.toLocaleDateString("en-US", { month: "short" }),
        earned,
        spent,
      });
    }

    // Calculate bonus rate tiers based on total pledges
    const pledgeCount = pledges.length;
    let currentTier = "Bronze";
    let bonusRate = 1;
    let nextTier = "Silver";
    let pledgesToNextTier = 5 - pledgeCount;

    if (pledgeCount >= 25) {
      currentTier = "Diamond";
      bonusRate = 5;
      nextTier = "";
      pledgesToNextTier = 0;
    } else if (pledgeCount >= 15) {
      currentTier = "Gold";
      bonusRate = 3;
      nextTier = "Diamond";
      pledgesToNextTier = 25 - pledgeCount;
    } else if (pledgeCount >= 5) {
      currentTier = "Silver";
      bonusRate = 2;
      nextTier = "Gold";
      pledgesToNextTier = 15 - pledgeCount;
    }

    return NextResponse.json({
      balance: Number(user.divinityCoins || 0),
      totalEarned,
      totalSpent,
      transactions,
      monthlyData,
      tier: {
        current: currentTier,
        bonusRate,
        next: nextTier,
        pledgesToNext: Math.max(0, pledgesToNextTier),
        totalPledges: pledgeCount,
      },
      memberSince: user.createdAt,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error fetching wallet data:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet data" },
      { status: 500, headers: corsHeaders }
    );
  }
}
