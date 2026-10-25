import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { alertAdmins } from "@/lib/admin-alerts";
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
// Thirty days, not one. A backer's paid pledge sat PENDING for five days
// because the sweeper stopped looking after 24h and nothing told anyone.
// One lookup per stuck pledge per tick is cheap; MAX_PLEDGES_PER_TICK
// still bounds the DC traffic.
const MAX_AGE_HOURS = 24 * 30;
// Anything PENDING this long with a successful payment is a backer who
// has been waiting; say so loudly when it's finally committed.
const LATE_COMMIT_MINUTES = 60;

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
// Runs every 5 minutes. On the PM2/crontab deployment it must be in the
// crontab — it is not, by itself, scheduled by anything:
//   */5 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://indiecrowdfund.com/api/cron/reconcile-dc-pledges
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
        createdAt: true,
        amount: true,
        divinityCoinPaymentId: true,
        divinityCoinCheckoutSessionId: true,
        user: { select: { email: true } },
        project: { select: { title: true } },
      },
      take: MAX_PLEDGES_PER_TICK,
    });

    let checked = 0;
    let committed = 0;
    let failedAtGateway = 0;
    let stillPending = 0;
    let errored = 0;
    const lateCommits: string[] = [];
    const gatewayFailures: string[] = [];

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
          const ageMin = Math.round((Date.now() - new Date(p.createdAt).getTime()) / 60000);
          if (ageMin >= LATE_COMMIT_MINUTES) {
            lateCommits.push(`${p.user?.email ?? p.id} · $${Number(p.amount).toFixed(2)} · "${p.project?.title ?? "?"}" · stuck ${ageMin >= 120 ? `${Math.round(ageMin / 60)}h` : `${ageMin}m`}`);
          }
        } else if (verified.status === "failed") {
          // Genuinely failed at the gateway but still PENDING locally.
          // Don't auto-flip to FAILED from the cron — the stats rollback
          // is delicate and we want eyes on a real decline that slipped
          // past our webhook handler. Surface loudly for admin review.
          failedAtGateway++;
          gatewayFailures.push(`${p.user?.email ?? p.id} · $${Number(p.amount).toFixed(2)} · "${p.project?.title ?? "?"}"`);
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

    // Tell a human. A pledge that needed the sweeper after an hour means
    // the backer saw "Payment complete. Returning…" hang and has probably
    // already written in; one DC says failed needs eyes.
    if (lateCommits.length > 0) {
      await alertAdmins({
        title: `Recovered ${lateCommits.length} stuck pledge${lateCommits.length === 1 ? "" : "s"}`,
        message: `These backers paid but their pledge sat PENDING until the reconcile sweep committed it:\n\n${lateCommits.join("\n")}\n\nThey have now been confirmed and emailed. If any wrote to support, reply and let them know.`,
        actionUrl: "/admin/reconcile",
        email: true,
      });
    }
    if (gatewayFailures.length > 0) {
      await alertAdmins({
        title: `${gatewayFailures.length} pledge${gatewayFailures.length === 1 ? "" : "s"} failed at DivinityCoin but still PENDING`,
        message: `DivinityCoin reports the payment failed, but the pledge is still PENDING here and needs a decision:\n\n${gatewayFailures.join("\n")}`,
        actionUrl: "/admin/reconcile",
        email: true,
        throttleKey: "reconcile-gateway-failed",
        throttleMinutes: 360,
      });
    }
    if (errored > 0 && checked > 0 && errored === checked) {
      await alertAdmins({
        title: "Reconcile sweep cannot reach DivinityCoin",
        message: `Every one of ${checked} stuck pledge lookups errored this tick. Stuck pledges are not being recovered until this clears.`,
        actionUrl: "/admin/reconcile",
        email: true,
        throttleKey: "reconcile-dc-down",
        throttleMinutes: 120,
      });
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
