import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import {
  verifyDcPayment,
  getDcCheckoutSession,
  handlePaymentSucceeded,
} from "@/lib/payments/divinitycoin";

const log = logger.child({ module: "cron-reconcile-dc-pledges" });

// Bound DC API traffic per tick. Lifting this past ~100 routinely tripped
// DC's per-partner rate limit during the migration; if there's ever a real
// backlog the next tick (5 min later) picks up where this one stopped.
const MAX_PLEDGES_PER_TICK = 100;

// Lower bound: the checkout.completed / payment.succeeded webhook has a
// fair shot at landing first; we don't want to race it.
const MIN_AGE_MINUTES = 10;

// Upper bound: a PaymentIntent that's been pending at DC for a full day
// isn't a missed webhook anymore — it's an abandoned or in-limbo intent
// that polling won't fix. Past this we surface the pledge in admin /
// reconcile-pledges for human review instead of pegging DC's API.
const MAX_AGE_HOURS = 24;

// Reconcile DC pledges stuck in PENDING because the user's iframe never
// delivered the "complete" postMessage AND the webhook also failed to
// commit (origin mismatch, mobile webview quirks, transient outage).
// This is the missing backstop for KIA pledges — the existing
// process-funded-campaigns sweeper only fires for AoN campaigns that
// crossed their funding goal, so KIA pledges had no automatic recovery
// path. Result: backers whose payment succeeded at the gateway saw the
// "Payment complete. Returning..." iframe message hang forever and the
// pledge stayed invisible in their dashboard. This sweeper checks DC's
// authoritative status for each stuck PENDING DC pledge and commits via
// the same handlePaymentSucceeded path the webhook uses (CAS-guarded,
// idempotent — safe if the real webhook lands seconds later).
//
// Scheduled every 5 minutes via vercel.json.
//
// Security: protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const newerThan = new Date(Date.now() - MIN_AGE_MINUTES * 60 * 1000);
    const olderThan = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);

    // Sweep across ALL projects (not scoped to a funding-success event).
    // Pulls pledges with either a stamped PaymentIntent (confirm-dc-checkout
    // ran but webhook dropped) or only a checkout-session id (postMessage
    // dropped, confirm-dc-checkout never ran).
    const stuck = await db.pledge.findMany({
      where: {
        status: "PENDING",
        paymentProcessor: "DIVINITYCOIN",
        deletedAt: null,
        createdAt: { lt: newerThan, gte: olderThan },
        OR: [
          { NOT: { divinityCoinPaymentId: null } },
          { NOT: { divinityCoinCheckoutSessionId: null } },
        ],
      },
      select: {
        id: true,
        divinityCoinPaymentId: true,
        divinityCoinCheckoutSessionId: true,
      },
      take: MAX_PLEDGES_PER_TICK,
    });

    let checked = 0;
    let committed = 0;
    let failedAtGateway = 0;
    let stillPending = 0;
    let errored = 0;

    for (const p of stuck) {
      checked++;
      try {
        // If we don't have a PaymentIntent yet, fish one out of the
        // checkout session. This is the postMessage-dropped scenario
        // where confirm-dc-checkout never ran.
        let paymentIntentId = p.divinityCoinPaymentId;
        if (!paymentIntentId && p.divinityCoinCheckoutSessionId) {
          const sessionResult = await getDcCheckoutSession(p.divinityCoinCheckoutSessionId);
          if (sessionResult.success && sessionResult.session.paymentIntentId) {
            paymentIntentId = sessionResult.session.paymentIntentId;
            await db.pledge.update({
              where: { id: p.id },
              data: { divinityCoinPaymentId: paymentIntentId },
            });
          }
        }
        if (!paymentIntentId) {
          stillPending++;
          continue;
        }

        const verified = await verifyDcPayment(paymentIntentId);
        if (!verified.success) {
          errored++;
          continue;
        }

        if (verified.status === "succeeded") {
          await handlePaymentSucceeded({
            pledgeId: p.id,
            paymentId: paymentIntentId,
          });
          committed++;
          log.info(
            { pledgeId: p.id, paymentIntentId },
            "[Reconcile DC] Committed stuck pledge via verify-payment"
          );
        } else if (verified.status === "failed") {
          // Genuinely failed at the gateway but still PENDING locally.
          // Don't auto-flip to FAILED from the cron — the stats rollback
          // is delicate and we want eyes on a real decline that slipped
          // past our webhook handler. Surface loudly for admin review.
          failedAtGateway++;
          log.warn(
            { pledgeId: p.id, paymentIntentId },
            "[Reconcile DC] DC reports failed for stuck pledge — needs manual review"
          );
        } else {
          stillPending++;
        }
      } catch (err) {
        errored++;
        log.error(
          { err: err instanceof Error ? err.message : String(err), pledgeId: p.id },
          "[Reconcile DC] Error reconciling pledge"
        );
      }
    }

    return NextResponse.json({
      checked,
      committed,
      failedAtGateway,
      stillPending,
      errored,
    });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "[Reconcile DC] Sweep error"
    );
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}
