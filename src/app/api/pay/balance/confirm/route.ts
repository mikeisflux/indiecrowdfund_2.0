import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { confirmBalancePayment } from "@/lib/indiekit/balance-confirm";

const payBalanceConfirmLogger = logger.child({ module: "pay-balance-confirm" });

// POST - Confirm balance payment was successful.
//
// The browser's call after the card form succeeds. It is one of three
// paths into confirmBalancePayment (processor webhook and reconcile sweep
// are the others), so a failure here no longer loses the payment — but it
// still answers honestly, so the page can say "verifying" rather than
// "paid" when the processor hasn't reported success yet.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    // The Whop embed posts to its confirm URL with an empty body (or just
    // a receiptId), so the token may arrive on the query string instead.
    const token: string | undefined = body.token || req.nextUrl.searchParams.get("token") || undefined;
    const paymentIntentId: string | undefined = typeof body.paymentIntentId === "string" ? body.paymentIntentId : undefined;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const pledges = await db.pledge.findMany({
      where: {
        status: "COMPLETED",
        deletedAt: null,
        metadata: { path: ["balancePaymentToken"], equals: token },
      },
      select: { id: true },
    });
    if (pledges.length === 0) {
      return NextResponse.json({ error: "Invalid payment link" }, { status: 404 });
    }
    if (pledges.length > 1) {
      payBalanceConfirmLogger.error({ pledgeCount: pledges.length }, "Duplicate balance payment tokens found");
      return NextResponse.json({ error: "Invalid payment link" }, { status: 400 });
    }

    const result = await confirmBalancePayment({ pledgeId: pledges[0].id, source: "browser", clientIntentId: paymentIntentId ?? null });
    switch (result.status) {
      case "confirmed":
        return NextResponse.json({ success: true, amountPaid: result.amount });
      case "already":
        return NextResponse.json({ success: true, message: "Already confirmed", amountPaid: result.amount });
      case "unpaid":
        return NextResponse.json({ error: "Payment not completed. Please try again.", pending: true }, { status: 400 });
      case "mismatch":
      case "missing":
      case "unsupported":
        return NextResponse.json({ error: result.error || "Payment could not be verified" }, { status: 400 });
      default:
        return NextResponse.json({ error: "Could not verify payment. Please try again." }, { status: 500 });
    }
  } catch (error) {
    payBalanceConfirmLogger.error({ err: formatError(error) }, "Error confirming balance payment:");
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
