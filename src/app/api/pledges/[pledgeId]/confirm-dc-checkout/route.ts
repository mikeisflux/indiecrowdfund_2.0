import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  commitDcPledge,
  getDcCheckoutSession,
} from "@/lib/payments/divinitycoin";

const log = logger.child({ module: "pledges-confirm-dc-checkout" });

/**
 * POST /api/pledges/[pledgeId]/confirm-dc-checkout
 *
 * Called by the browser after the user returns from divinitycoin.com's
 * hosted checkout page with ?session_id=cs_... appended to our
 * returnUrl. Reconciles the pledge against DC's authoritative
 * checkout-session status and runs the commit if applicable.
 *
 * Race model: the checkout.completed webhook fires in parallel and
 * may have already committed the pledge. Both paths converge on
 * commitDcPledge (for SETUP mode) or handlePaymentSucceeded (for
 * PAYMENT mode) — atomic CAS inside each one guarantees exactly one
 * runs the side effects (counter bumps, slot claims, email).
 *
 * SETUP mode: we call commitDcPledge with the paymentMethodId from
 * the session. If the webhook beat us to it, the CAS no-ops and we
 * respond ok=true with alreadyConfirmed=true.
 *
 * PAYMENT mode: we leave the commit to the existing
 * payment.succeeded webhook path (handlePaymentSucceeded). This
 * route just polls until the session reports status=complete and
 * confirms we have a paymentIntentId on record; the cron is the
 * deeper backstop if the webhook never fires.
 *
 * Pending / failed / expired / canceled session states surface
 * back to the client with an appropriate response so the return
 * page can render the right UI.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const authSession = await auth();
    if (!authSession?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        paymentProcessor: true,
        status: true,
        chargedImmediately: true,
        divinityCoinCheckoutSessionId: true,
        divinityCoinPaymentId: true,
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }
    if (pledge.userId !== authSession.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (pledge.paymentProcessor !== "DIVINITYCOIN") {
      return NextResponse.json({ error: "Pledge is not on DivinityCoin" }, { status: 400 });
    }
    if (!pledge.divinityCoinCheckoutSessionId) {
      return NextResponse.json(
        { error: "Pledge has no DC checkout session — not a hosted-checkout pledge" },
        { status: 400 }
      );
    }
    if (pledge.status === "COMPLETED") {
      // Already committed by webhook or earlier confirm. Idempotent
      // success — return same shape the freshly-committed branch
      // returns so the client can treat both uniformly.
      return NextResponse.json({
        ok: true,
        pledgeId: pledge.id,
        alreadyConfirmed: true,
        status: pledge.status,
      });
    }
    if (pledge.status !== "PENDING") {
      return NextResponse.json(
        { error: `Pledge is ${pledge.status.toLowerCase()}; cannot confirm` },
        { status: 400 }
      );
    }

    // Pull the authoritative session state from DC. DC self-heals on
    // this call — if their local session is stale but the underlying
    // PI / SI has settled at the processor, they refresh before
    // responding. So this is the source of truth once the user is back.
    const result = await getDcCheckoutSession(pledge.divinityCoinCheckoutSessionId);
    if (!result.success) {
      log.error(
        { pledgeId: pledge.id, sessionId: pledge.divinityCoinCheckoutSessionId, err: result.error },
        "[confirm-dc-checkout] get-checkout-session failed"
      );
      return NextResponse.json(
        { error: "Could not verify checkout session. Please try again." },
        { status: 502 }
      );
    }

    const { session: dcSession } = result;

    // Non-success terminal states. The webhook handlers also mark the
    // pledge appropriately, but the user-return path may beat the
    // webhook; surface a meaningful response either way.
    if (dcSession.status === "failed") {
      return NextResponse.json({
        ok: false,
        status: "failed",
        message: "Card was declined or the checkout couldn't complete. Please try a different card.",
      }, { status: 400 });
    }
    if (dcSession.status === "expired") {
      return NextResponse.json({
        ok: false,
        status: "expired",
        message: "Checkout session expired. Please start a new pledge.",
      }, { status: 400 });
    }
    if (dcSession.status === "canceled") {
      return NextResponse.json({
        ok: false,
        status: "canceled",
        message: "Checkout was cancelled. Your pledge wasn't completed.",
      }, { status: 400 });
    }
    if (dcSession.status === "pending") {
      // User clicked back to us before completing on DC's page.
      return NextResponse.json({
        ok: false,
        status: "pending",
        message: "Checkout is still in progress. Please complete payment on the DivinityCoin page.",
      }, { status: 202 });
    }

    // status === "complete" — commit or trust the webhook depending on mode.
    if (dcSession.mode === "setup") {
      if (!dcSession.paymentMethodId) {
        log.error(
          { pledgeId: pledge.id, sessionId: dcSession.sessionId },
          "[confirm-dc-checkout] SETUP session complete but no paymentMethodId returned"
        );
        return NextResponse.json(
          { error: "Checkout completed but no saved card was returned. Please retry." },
          { status: 502 }
        );
      }

      const commit = await commitDcPledge({
        pledgeId: pledge.id,
        paymentMethodId: dcSession.paymentMethodId,
        setupIntentId: dcSession.setupIntentId ?? undefined,
        source: "confirm-dc-checkout (setup)",
      });

      if (!commit.ok) {
        return NextResponse.json({ error: commit.error }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        pledgeId: pledge.id,
        alreadyConfirmed: commit.alreadyCommitted,
        mode: "setup",
      });
    }

    // PAYMENT mode: handlePaymentSucceeded is the canonical commit
    // path (driven by the payment.succeeded webhook). Stamp the PI on
    // the pledge if we haven't already so the cron + verify-payment
    // safety net can find it; the webhook (or the cron) will flip
    // status to COMPLETED.
    if (dcSession.paymentIntentId && pledge.divinityCoinPaymentId !== dcSession.paymentIntentId) {
      await db.pledge.update({
        where: { id: pledge.id },
        data: { divinityCoinPaymentId: dcSession.paymentIntentId },
      });
    }

    return NextResponse.json({
      ok: true,
      pledgeId: pledge.id,
      mode: "payment",
      // payment.succeeded webhook commits the pledge — typically lands
      // within a couple seconds. Client should poll /api/pledges/[id]
      // (or just optimistically show "Pledge received" — confirmation
      // email lands soon after).
      pendingWebhook: true,
    });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "confirm-dc-checkout error"
    );
    return NextResponse.json(
      { error: "Failed to confirm checkout" },
      { status: 500 }
    );
  }
}
