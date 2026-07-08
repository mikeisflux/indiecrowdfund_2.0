import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { syncPayPalConnectAccount } from "@/lib/payments/paypal-connect";

const log = logger.child({ module: "paypal-connect-complete" });

export const dynamic = "force-dynamic";

// GET - PayPal redirects the creator here after they finish the Partner
// Referrals signup. PayPal appends query params including:
//   merchantId          -> our tracking_id (the creator's userId)
//   merchantIdInPayPal  -> the creator's PayPal merchant id (the payee)
//   permissionsGranted, consentStatus, isEmailConfirmed, accountStatus
// We record the merchant id + confirm receivable status, then redirect the
// creator back to their settings page. Onboarding is not "trusted" from these
// params alone — readiness is confirmed via the seller-status API/webhook.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;

  const trackingId = params.get("merchantId"); // our userId
  const merchantIdInPayPal = params.get("merchantIdInPayPal");
  const permissionsGranted = params.get("permissionsGranted") === "true";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "";
  const settingsUrl = new URL("/dashboard/settings", baseUrl || url.origin);

  try {
    // Prefer the authenticated session; fall back to the tracking_id PayPal
    // echoes back (which we set to the creator's userId).
    const session = await auth();
    const userId = session?.user?.id || trackingId || null;

    if (userId && merchantIdInPayPal && permissionsGranted) {
      // Only sync if this account was actually the one that started onboarding.
      const existing = await db.payPalConnectAccount.findUnique({
        where: { userId },
        select: { userId: true },
      });
      if (existing) {
        await syncPayPalConnectAccount(userId, merchantIdInPayPal).catch((err) =>
          log.warn({ err: formatError(err), userId }, "PayPal Connect sync on return failed"),
        );
      }
      settingsUrl.searchParams.set("paypalConnect", "connected");
    } else {
      settingsUrl.searchParams.set("paypalConnect", "incomplete");
    }
  } catch (error) {
    log.error({ err: formatError(error) }, "PayPal Connect return handler error");
    settingsUrl.searchParams.set("paypalConnect", "error");
  }

  return NextResponse.redirect(settingsUrl.toString());
}
