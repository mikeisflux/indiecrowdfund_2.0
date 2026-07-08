import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { syncPayPalConnectAccount } from "@/lib/payments/paypal-connect";

const log = logger.child({ module: "paypal-connect-status" });

export const dynamic = "force-dynamic";

// GET - Return the signed-in creator's PayPal Connect onboarding status. When a
// merchant id is known, refresh receivable/email flags live from PayPal.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await db.payPalConnectAccount.findUnique({
      where: { userId: session.user.id },
      select: {
        merchantIdInPayPal: true,
        onboardingStatus: true,
        paymentsReceivable: true,
        emailConfirmed: true,
        isLive: true,
        updatedAt: true,
      },
    });

    if (!account) {
      return NextResponse.json({ connected: false, status: "NOT_STARTED" });
    }

    // If we have a merchant id but aren't confirmed ready yet, re-check PayPal.
    let ready = account.paymentsReceivable && account.emailConfirmed;
    if (account.merchantIdInPayPal && !ready) {
      try {
        ready = await syncPayPalConnectAccount(session.user.id, account.merchantIdInPayPal);
      } catch (err) {
        log.warn({ err: formatError(err) }, "PayPal Connect live status refresh failed");
      }
    }

    return NextResponse.json({
      connected: Boolean(account.merchantIdInPayPal),
      ready,
      status: account.onboardingStatus,
      merchantIdInPayPal: account.merchantIdInPayPal,
      paymentsReceivable: account.paymentsReceivable,
      emailConfirmed: account.emailConfirmed,
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to fetch PayPal Connect status");
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
