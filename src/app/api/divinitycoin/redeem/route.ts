import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/divinitycoin/redeem
 *
 * Redeem a DivinityCoin code and add credits to the user's account
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in to redeem codes" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Redemption code is required" },
        { status: 400 }
      );
    }

    // Clean up the code (remove dashes, spaces, etc.)
    const cleanCode = code.replace(/[-\s]/g, "").toUpperCase();

    if (cleanCode.length < 8) {
      return NextResponse.json(
        { error: "Invalid redemption code format" },
        { status: 400 }
      );
    }

    // Check if DivinityCoin is enabled
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        divinityCoinEnabled: true,
        divinityCoinApiKey: true,
      },
    });

    if (!settings?.divinityCoinEnabled) {
      return NextResponse.json(
        { error: "DivinityCoin is not enabled on this platform" },
        { status: 400 }
      );
    }

    if (!settings.divinityCoinApiKey) {
      return NextResponse.json(
        { error: "DivinityCoin API key not configured" },
        { status: 500 }
      );
    }

    // Call DivinityCoin API to validate and redeem the code
    const divinityResponse = await fetch("https://api.divinitycoin.com/internal/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": settings.divinityCoinApiKey,
      },
      body: JSON.stringify({
        code: cleanCode,
        platformUserId: session.user.id,
      }),
    });

    const divinityResult = await divinityResponse.json();

    if (!divinityResponse.ok) {
      // Map DivinityCoin error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        INVALID_CODE_FORMAT: "Invalid code format",
        CODE_NOT_FOUND: "This code does not exist",
        ALREADY_REDEEMED: "This code has already been redeemed",
        CODE_EXPIRED: "This code has expired",
        CODE_REVOKED: "This code has been revoked",
        RATE_LIMITED: "Too many attempts. Please try again later.",
      };
      const errorMessage = errorMessages[divinityResult.code] || divinityResult.error || "Failed to validate code";
      return NextResponse.json(
        { error: errorMessage },
        { status: divinityResponse.status }
      );
    }

    const amount = divinityResult.amount;

    // Create local redemption record for tracking
    await db.divinityCoinRedemption.create({
      data: {
        code: cleanCode,
        userId: session.user.id,
        amount,
        redeemedAt: new Date(),
      },
    });

    // Update user's DivinityCoin balance with the amount from the API
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        divinityCoinBalance: {
          increment: amount,
        },
      },
      select: { divinityCoinBalance: true },
    });

    return NextResponse.json({
      success: true,
      amount,
      newBalance: updatedUser.divinityCoinBalance,
      message: `Successfully redeemed $${amount.toFixed(2)} in DivinityCoin credits`,
    });
  } catch (error) {
    console.error("[DivinityCoin Redeem] Error:", error);
    return NextResponse.json(
      { error: "Failed to redeem code. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/divinitycoin/redeem
 *
 * Get user's DivinityCoin balance and redemption history
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        divinityCoinBalance: true,
        divinityCoinRedemptions: {
          orderBy: { redeemedAt: "desc" },
          take: 10,
          select: {
            id: true,
            amount: true,
            redeemedAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      balance: user?.divinityCoinBalance || 0,
      redemptions: user?.divinityCoinRedemptions || [],
    });
  } catch (error) {
    console.error("[DivinityCoin Balance] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
