import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const payBalanceConfirmLogger = logger.child({ module: "pay-balance-confirm" });
import { db } from "@/lib/db";

// POST - Confirm balance payment was successful
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, paymentIntentId } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Find pledge with this payment token
    const pledges = await db.pledge.findMany({
      where: {
        status: "COMPLETED",
        deletedAt: null,
        metadata: {
          path: ["balancePaymentToken"],
          equals: token,
        },
      },
    });

    if (pledges.length === 0) {
      return NextResponse.json({ error: "Invalid payment link" }, { status: 404 });
    }

    const pledge = pledges[0];
    const meta = (pledge.metadata as Record<string, unknown>) || {};

    // Check if already confirmed
    if (meta.balancePaymentCompletedAt) {
      return NextResponse.json({ success: true, message: "Already confirmed" });
    }

    // Calculate balance due — prefer the stored value (set by order edits or balance adjustments)
    // Use balanceDueAmount (set by creator/order-edit) or balanceDue (legacy key) as the stored override
    const storedBalanceDue = meta.balanceDueAmount != null ? Number(meta.balanceDueAmount) : (meta.balanceDue != null ? Number(meta.balanceDue) : null);
    const pledgeTotal = Number(pledge.amount);
    const expectedTotal = Number(pledge.rewardAmount) + Number(pledge.addonsAmount) + Number(pledge.shippingAmount);
    const balanceDue = storedBalanceDue !== null
      ? Math.max(0, Math.round(storedBalanceDue * 100) / 100)
      : Math.max(0, Math.round((expectedTotal - pledgeTotal) * 100) / 100);

    // Use a transaction to atomically mark as confirmed and prevent double-processing
    const confirmed = await db.$transaction(async (tx) => {
      // Re-fetch the pledge with a lock to guard against concurrent requests
      const current = await tx.pledge.findUnique({ where: { id: pledge.id } });
      if (!current) return false;
      const currentMeta = (current.metadata as Record<string, unknown>) || {};
      if (currentMeta.balancePaymentCompletedAt) return false; // Already done

      await tx.pledge.update({
        where: { id: pledge.id },
        data: {
          amount: { increment: balanceDue },
          metadata: {
            ...currentMeta,
            balancePaymentCompletedAt: new Date().toISOString(),
            balancePaymentIntentId: paymentIntentId || currentMeta.balancePaymentIntentId,
            balanceAmountPaid: balanceDue,
          },
        },
      });

      await tx.project.update({
        where: { id: pledge.projectId },
        data: { currentAmount: { increment: balanceDue } },
      });

      return true;
    });

    if (!confirmed) {
      return NextResponse.json({ success: true, message: "Already confirmed" });
    }

    return NextResponse.json({
      success: true,
      amountPaid: balanceDue,
    });
  } catch (error) {
    payBalanceConfirmLogger.error({ err: String(error) }, "Error confirming balance payment:");
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
