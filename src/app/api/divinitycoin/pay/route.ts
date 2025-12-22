import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/divinitycoin/pay
 *
 * Process a payment using DivinityCoin balance
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { pledgeId, amount } = body;

    if (!pledgeId || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid payment request" },
        { status: 400 }
      );
    }

    // Get user's current balance
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { divinityCoinBalance: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user has sufficient balance
    if (user.divinityCoinBalance < amount) {
      return NextResponse.json(
        { error: "Insufficient DivinityCoin balance" },
        { status: 400 }
      );
    }

    // Get the pledge
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      include: {
        project: {
          select: {
            id: true,
            paymentProcessor: true,
            creatorId: true,
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json(
        { error: "Pledge not found" },
        { status: 404 }
      );
    }

    // Verify pledge belongs to this user
    if (pledge.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Verify project uses DivinityCoin
    if (pledge.project.paymentProcessor !== "DIVINITYCOIN") {
      return NextResponse.json(
        { error: "This project does not accept DivinityCoin payments" },
        { status: 400 }
      );
    }

    // Process the payment in a transaction
    const result = await db.$transaction(async (tx) => {
      // Deduct from user's balance
      const updatedUser = await tx.user.update({
        where: { id: session.user.id },
        data: {
          divinityCoinBalance: {
            decrement: amount,
          },
        },
        select: { divinityCoinBalance: true },
      });

      // Calculate backer number
      const existingBackerCount = await tx.pledge.count({
        where: {
          projectId: pledge.projectId,
          backerNumber: { not: null },
        },
      });

      // Update pledge status
      await tx.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "COMPLETED",
          backerNumber: existingBackerCount + 1,
          divinityCoinPaymentId: `dc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        },
      });

      // Update project funding
      await tx.project.update({
        where: { id: pledge.projectId },
        data: {
          currentAmount: { increment: amount },
          backerCount: { increment: 1 },
        },
      });

      // Create a transaction record
      await tx.divinityCoinTransaction.create({
        data: {
          userId: session.user.id,
          pledgeId: pledgeId,
          amount: -amount, // Negative for payment
          type: "PAYMENT",
          description: `Pledge payment for project`,
        },
      });

      return updatedUser;
    });

    return NextResponse.json({
      success: true,
      newBalance: result.divinityCoinBalance,
      message: `Successfully paid $${amount.toFixed(2)} with DivinityCoin`,
    });
  } catch (error) {
    console.error("[DivinityCoin Pay] Error:", error);
    return NextResponse.json(
      { error: "Failed to process payment. Please try again." },
      { status: 500 }
    );
  }
}
