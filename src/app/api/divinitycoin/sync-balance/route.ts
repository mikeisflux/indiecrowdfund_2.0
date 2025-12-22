import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/divinitycoin/sync-balance
 *
 * Sync user's balance from DivinityCoin API
 */
export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    // Get DivinityCoin API settings
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        divinityCoinEnabled: true,
        divinityCoinApiKey: true,
      },
    });

    if (!settings?.divinityCoinEnabled || !settings.divinityCoinApiKey) {
      return NextResponse.json(
        { error: "DivinityCoin not configured" },
        { status: 400 }
      );
    }

    // Call DivinityCoin API to get current balance
    const divinityResponse = await fetch("https://divinitycoin.com/internal?action=balance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.divinityCoinApiKey}`,
      },
      body: JSON.stringify({
        platformUserId: session.user.id,
      }),
    });

    if (!divinityResponse.ok) {
      let errorMessage = "Failed to fetch balance from DivinityCoin";
      try {
        const errorData = await divinityResponse.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Response wasn't JSON
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: divinityResponse.status }
      );
    }

    const divinityResult = await divinityResponse.json();
    const newBalance = divinityResult.availableBalance ?? 0;

    // Update local balance to match DivinityCoin
    await db.user.update({
      where: { id: session.user.id },
      data: { divinityCoinBalance: newBalance },
    });

    return NextResponse.json({
      success: true,
      balance: newBalance,
      heldBalance: divinityResult.heldBalance || 0,
    });
  } catch (error) {
    console.error("[DivinityCoin Sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to sync balance" },
      { status: 500 }
    );
  }
}
