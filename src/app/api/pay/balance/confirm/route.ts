import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const payBalanceConfirmLogger = logger.child({ module: "pay-balance-confirm" });
import { db } from "@/lib/db";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";
import { verifyWhopUpchargePayment } from "@/lib/payments/whop/upcharge";

// POST - Confirm balance payment was successful
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    // The Whop embed posts to its confirm URL with an empty body (or just
    // a receiptId), so the token may arrive on the query string instead.
    const token: string | undefined = body.token || req.nextUrl.searchParams.get("token") || undefined;
    const paymentIntentId: string | undefined = body.paymentIntentId;

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

    // Verify the payment actually succeeded before crediting the balance,
    // with the processor the campaign ran on. Never trust the client.
    const paymentProcessor = (pledge as { project?: { paymentProcessor?: string } }).project?.paymentProcessor;
    let verifiedAmount: number | undefined;
    let paymentReference: string | undefined;

    if (paymentProcessor === "DIVINITYCOIN") {
      const storedDcPaymentId = meta.balanceDivinityCoinPaymentId as string | undefined;
      // The intent we verify must be the one this pledge's balance flow
      // created. The client-supplied id used to win, so any succeeded $1
      // intent from anywhere on the platform could clear an arbitrary balance.
      if (storedDcPaymentId && paymentIntentId && storedDcPaymentId !== paymentIntentId) {
        payBalanceConfirmLogger.warn({ pledgeId: pledge.id, storedDcPaymentId, paymentIntentId }, "[Balance Confirm] client intent id does not match the stored one");
        return NextResponse.json({ error: "Payment reference does not match this balance" }, { status: 400 });
      }
      const dcIntentId = storedDcPaymentId || paymentIntentId;
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
        const a = (verifyResult.data as { amount?: unknown } | undefined)?.amount;
        if (typeof a === "number") verifiedAmount = a;
      } catch (dcErr) {
        payBalanceConfirmLogger.error({ err: String(dcErr) }, "[Balance Confirm] DC verify error:");
        return NextResponse.json({ error: "Could not verify payment. Please try again." }, { status: 500 });
      }
      paymentReference = dcIntentId;
    } else if (paymentProcessor === "WHOP") {
      // The checkout configuration /api/pay/balance created for this
      // balance; a paid Whop payment against it is the proof.
      const checkoutId = typeof meta.balanceWhopCheckoutId === "string" ? meta.balanceWhopCheckoutId : null;
      if (!checkoutId) {
        payBalanceConfirmLogger.warn({ pledgeId: pledge.id }, "[Balance Confirm] No Whop checkout id to verify");
        return NextResponse.json({ error: "Payment not verified — missing payment reference" }, { status: 400 });
      }
      const verify = await verifyWhopUpchargePayment(checkoutId);
      if (!verify.paid) {
        payBalanceConfirmLogger.warn({ pledgeId: pledge.id, checkoutId }, "[Balance Confirm] Whop payment not found as paid");
        return NextResponse.json({ error: "Payment not completed. Please try again." }, { status: 400 });
      }
      paymentReference = verify.paymentId || checkoutId;
    } else {
      return NextResponse.json(
        { error: "This campaign's payment processor cannot take balance payments" },
        { status: 400 }
      );
    }

    // Calculate balance due — prefer the stored value (set by order edits or balance adjustments)
    // Use balanceDueAmount (set by creator/order-edit) or balanceDue (legacy key) as the stored override
    const storedBalanceDue = meta.balanceDueAmount != null ? Number(meta.balanceDueAmount) : (meta.balanceDue != null ? Number(meta.balanceDue) : null);
    const pledgeTotal = Number(pledge.amount);
    const expectedTotal = Number(pledge.rewardAmount) + Number(pledge.addonsAmount) + Number(pledge.shippingAmount);
    const balanceDue = storedBalanceDue !== null
      ? Math.max(0, Math.round(storedBalanceDue * 100) / 100)
      : Math.max(0, Math.round((expectedTotal - pledgeTotal) * 100) / 100);

    // The verified charge has to be FOR this balance. DC reports the amount
    // in cents or dollars depending on the action version; accept either.
    if (typeof verifiedAmount === "number") {
      const matchesDollars = Math.abs(verifiedAmount - balanceDue) <= 0.01;
      const matchesCents = Math.abs(verifiedAmount - Math.round(balanceDue * 100)) <= 0.5;
      if (!matchesDollars && !matchesCents) {
        payBalanceConfirmLogger.warn({ pledgeId: pledge.id, verifiedAmount, balanceDue }, "[Balance Confirm] verified amount does not match balance due");
        return NextResponse.json({ error: "Payment amount does not match the balance due" }, { status: 400 });
      }
    }

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
            balancePaymentIntentId: paymentReference || paymentIntentId || currentMeta.balancePaymentIntentId,
            balancePaymentProcessor: paymentProcessor,
            balanceAmountPaid: balanceDue,
            // The stored balance is what IndieKit reads as "still owes";
            // it never came down after payment, so paid orders kept
            // showing as Not Charged.
            ...(currentMeta.balanceDue != null
              ? { balanceDue: Math.max(0, Math.round((Number(currentMeta.balanceDue) - balanceDue) * 100) / 100) }
              : {}),
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
    payBalanceConfirmLogger.error({ err: formatError(error) }, "Error confirming balance payment:");
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
