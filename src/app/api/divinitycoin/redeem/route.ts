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

    // TODO: Call DivinityCoin API to validate and redeem the code
    // For now, we'll simulate the redemption process
    // In production, this would call the DivinityCoin API

    // Simulated validation - in production this calls DivinityCoin's API
    // The API would return the amount associated with the code

    // For demo purposes, parse amount from code pattern or use fixed amount
    // Real implementation would validate against DivinityCoin's servers
    const amount = 25.00; // Default demo amount

    // Check if code has already been redeemed (store in database)
    const existingRedemption = await db.divinityCoinRedemption.findUnique({
      where: { code: cleanCode },
    });

    if (existingRedemption) {
      return NextResponse.json(
        { error: "This code has already been redeemed" },
        { status: 400 }
      );
    }

    // Create redemption record
    await db.divinityCoinRedemption.create({
      data: {
        code: cleanCode,
        userId: session.user.id,
        amount,
        redeemedAt: new Date(),
      },
    });

    // Update user's DivinityCoin balance
    await db.user.update({
      where: { id: session.user.id },
      data: {
        divinityCoinBalance: {
          increment: amount,
        },
      },
    });

    return NextResponse.json({
      success: true,
      amount,
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
