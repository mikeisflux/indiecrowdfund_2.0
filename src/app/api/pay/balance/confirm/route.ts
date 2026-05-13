import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const payBalanceConfirmLogger = logger.child({ module: "pay-balance-confirm" });
import { db } from "@/lib/db";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";

// POST - Confirm balance payment was successful
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, paymentIntentId } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Find pledge with this payment token (include project for payment processor)
    const pledges = await db.pledge.findMany({
      where: {
        status: "COMPLETED",
        deletedAt: null,
        metadata: {
          path: ["balancePaymentToken"],
          equals: token,
        },
      },
      include: {
        project: {
          select: { paymentProcessor: true },
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

    // Verify the payment actually succeeded before crediting the balance.
    // Balance payments are only DivinityCoin now.
    const storedDcPaymentId = meta.balanceDivinityCoinPaymentId as string | undefined;
    const paymentProcessor = (pledge as { project?: { paymentProcessor?: string } }).project?.paymentProcessor;

    const dcIntentId = paymentIntentId || storedDcPaymentId;

    if (paymentProcessor !== "DIVINITYCOIN") {
      return NextResponse.json(
        { error: "Balance payments are only supported for DivinityCoin pledges" },
        { status: 400 }
      );
    }

    if (!dcIntentId) {
      payBalanceConfirmLogger.warn({ pledgeId: pledge.id }, "[Balance Confirm] No DC payment ID to verify");
      return NextResponse.json({ error: "Payment not verified — missing payment reference" }, { status: 400 });
    }
    try {
      const verifyResult = await callDivinityCoinAPI("verify-payment", { paymentIntentId: dcIntentId });
      if (!verifyResult.success || verifyResult.data?.status !== "succeeded") {
        payBalanceConfirmLogger.warn({ pledgeId: pledge.id, dcIntentId }, "[Balance Confirm] DC payment not succeeded");
        return NextResponse.json({ error: "Payment not completed. Please try again." }, { status: 400 });
      }
    } catch (dcErr) {
      payBalanceConfirmLogger.error({ err: String(dcErr) }, "[Balance Confirm] DC verify error:");
      return NextResponse.json({ error: "Could not verify payment. Please try again." }, { status: 500 });
    }

    // Calculate balance due — prefer the stored value (set by order edits or balance adjustments)
    // Use balanceDueAmount (set by creator/order-edit) or balanceDue (legacy key) as the stored override
    const storedBalanceDue = meta.balanceDueAmount != null ? Number(meta.balanceDueAmount) : (meta.balanceDue != null ? Number(meta.balanceDue) : null);
    const pledgeTotal = Number(pledge.amount);
    const expectedTotal = Number(pledge.rewardAmount) + Number(pledge.addonsAmount) + Number(pledge.shippingAmount);
    const balanceDue = storedBalanceDue !== null
      ? Math.max(0, Math.round(storedBalanceDue * 100) / 100)
      : Math.max(0, Math.round((expectedTotal - pledgeTotal) * 100) / 100);

    // Use a transaction + SELECT FOR UPDATE row lock to atomically mark
    // as confirmed. Without the row lock, two concurrent confirm calls
    // (double-click, retry, or split tab) would both pass the
    // balancePaymentCompletedAt check inside the transaction because
    // READ COMMITTED isolation lets them both see the same pre-write
    // snapshot — resulting in a double credit to pledge.amount AND
    // project.currentAmount. FOR UPDATE serializes them so the second
    // acquirer sees the completed marker and bails.
    const confirmed = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Pledge" WHERE id = ${pledge.id} FOR UPDATE`;
      const current = await tx.pledge.findFirst({ where: { id: pledge.id, deletedAt: null } });
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
