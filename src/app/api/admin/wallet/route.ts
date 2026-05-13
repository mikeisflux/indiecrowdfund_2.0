import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminWalletLogger = logger.child({ module: "admin-wallet" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST - Zero out a user's Divinity Payments wallet balance (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin-only check
    const adminUser = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (adminUser?.role !== "ADMIN" && adminUser?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Look up name/email outside the lock (these don't race with balance).
    const targetUser = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Read-and-zero the balance under a row lock so concurrent DC webhooks
    // (refund/payment/bonus) can't change the balance between our read and
    // the zero-out — which would make both the audit transaction amount
    // wrong and lose the webhook's delta.
    let currentBalance = 0;
    let alreadyZero = false;
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const locked = await tx.user.findUnique({
        where: { id: userId },
        select: { divinityCoinBalance: true },
      });
      currentBalance = Number(locked?.divinityCoinBalance || 0);
      if (currentBalance === 0) {
        alreadyZero = true;
        return;
      }
      await tx.user.update({
        where: { id: userId },
        data: { divinityCoinBalance: 0 },
      });
      await tx.divinityCoinTransaction.create({
        data: {
          userId,
          amount: -currentBalance,
          type: "ADMIN_ZERO_BALANCE",
          description: `Wallet balance zeroed by admin (${session.user.email || session.user.id})`,
          metadata: JSON.stringify({
            previousBalance: currentBalance,
            newBalance: 0,
            zeroedBy: session.user.id,
            zeroedByEmail: session.user.email,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    });

    if (alreadyZero) {
      return NextResponse.json({
        success: true,
        message: "Wallet balance is already zero",
        previousBalance: 0,
        newBalance: 0,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Wallet balance zeroed for ${targetUser.name || targetUser.email}`,
      previousBalance: currentBalance,
      newBalance: 0,
    });
  } catch (error) {
    adminWalletLogger.error({ err: String(error) }, "Zero wallet balance error:");
    return NextResponse.json(
      { error: "Failed to zero wallet balance" },
      { status: 500 }
    );
  }
}
