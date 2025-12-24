import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/divinitycoin/sync-balance
 *
 * Refresh user's balance from local database
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

    // Fetch user's current balance from database
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { divinityCoinBalance: true },
    });

    return NextResponse.json({
      success: true,
      balance: Number(user?.divinityCoinBalance ?? 0),
    });
  } catch (error) {
    console.error("[DivinityCoin Sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to sync balance" },
      { status: 500 }
    );
  }
}
