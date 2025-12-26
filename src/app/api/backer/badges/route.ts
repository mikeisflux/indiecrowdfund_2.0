import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserBadgeSummary,
  getAvailableBonusPercent,
  checkAndAwardBadges,
} from "@/lib/redemption-bonus";

// CORS headers for API responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET: Get user's badge summary and bonus info
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const summary = await getUserBadgeSummary(session.user.id);
    const bonusInfo = await getAvailableBonusPercent(session.user.id);

    // Format badge types for display
    const badgeLabels: Record<string, { name: string; description: string; icon: string }> = {
      FIRST_PLEDGE: {
        name: "First Steps",
        description: "Made your first pledge",
        icon: "rocket",
      },
      SUPER_BACKER_10: {
        name: "Rising Star",
        description: "Backed 10+ projects",
        icon: "star",
      },
      SUPER_BACKER_25: {
        name: "Champion Backer",
        description: "Backed 25+ projects",
        icon: "trophy",
      },
      SUPER_BACKER_50: {
        name: "Legendary Supporter",
        description: "Backed 50+ projects",
        icon: "crown",
      },
      EARLY_BIRD: {
        name: "Early Bird",
        description: "Pledged within first 24 hours",
        icon: "zap",
      },
      SURVEY_COMPLETIONIST: {
        name: "Detail Oriented",
        description: "Completed all surveys",
        icon: "clipboard-check",
      },
    };

    const formattedBadges = summary.badges.map((badge) => ({
      ...badge,
      label: badgeLabels[badge.type] || {
        name: badge.type.replace(/_/g, " ").toLowerCase(),
        description: "",
        icon: "award",
      },
    }));

    return NextResponse.json({
      badges: formattedBadges,
      badgeCount: summary.badgeCount,
      bonus: {
        rawPercent: summary.rawBonusPercent,
        availablePercent: `${Number(bonusInfo.availablePercent).toFixed(4) * 100}%`,
        perBadge: "0.05%",
        monthlyCap: "0.03%",
      },
      monthlyStats: summary.monthlyStats,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error fetching badges:", error);
    return NextResponse.json(
      { error: "Failed to fetch badges" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST: Check and award new badges
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const newBadges = await checkAndAwardBadges(session.user.id);

    if (newBadges.length > 0) {
      // Get updated summary
      const summary = await getUserBadgeSummary(session.user.id);

      return NextResponse.json({
        newBadges,
        message: `Congratulations! You earned ${newBadges.length} new badge${newBadges.length > 1 ? "s" : ""}!`,
        updatedBadgeCount: summary.badgeCount,
        newBonusPercent: summary.rawBonusPercent,
      }, { headers: corsHeaders });
    }

    return NextResponse.json({
      newBadges: [],
      message: "No new badges to award",
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error checking badges:", error);
    return NextResponse.json(
      { error: "Failed to check badges" },
      { status: 500, headers: corsHeaders }
    );
  }
}
