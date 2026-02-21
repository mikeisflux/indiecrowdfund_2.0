import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST - Zero out a user's DivinityCoin wallet balance (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin-only check
    const adminUser = await db.user.findUnique({
      where: { id: session.user.id },
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

    // Get the user
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        divinityCoinBalance: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentBalance = Number(targetUser.divinityCoinBalance);

    if (currentBalance === 0) {
      return NextResponse.json({
        success: true,
        message: "Wallet balance is already zero",
        previousBalance: 0,
        newBalance: 0,
      });
    }

    // Zero out the balance and create an audit transaction
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { divinityCoinBalance: 0 },
      }),
      db.divinityCoinTransaction.create({
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
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Wallet balance zeroed for ${targetUser.name || targetUser.email}`,
      previousBalance: currentBalance,
      newBalance: 0,
    });
  } catch (error) {
    console.error("Zero wallet balance error:", error);
    return NextResponse.json(
      { error: "Failed to zero wallet balance" },
      { status: 500 }
    );
  }
}
