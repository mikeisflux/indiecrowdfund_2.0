import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const stripeConnectResetLogger = logger.child({ module: "stripe-connect-reset" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// DELETE - Reset/disconnect Stripe account
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete user's Stripe config via deleteMany — idempotent on
    // concurrent DELETE so a double-click doesn't P2025.
    const deleted = await db.stripeConfig.deleteMany({
      where: { userId: session.user.id },
    });

    if (deleted.count === 0) {
      return NextResponse.json({
        success: true,
        message: "No Stripe account was connected",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Stripe account disconnected successfully",
    });
  } catch (error) {
    stripeConnectResetLogger.error({ err: String(error) }, "Stripe reset error:");
    return NextResponse.json(
      { error: "Failed to reset Stripe connection" },
      { status: 500 }
    );
  }
}
