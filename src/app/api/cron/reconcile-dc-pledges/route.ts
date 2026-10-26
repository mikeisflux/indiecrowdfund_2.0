import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { alertAdmins } from "@/lib/admin-alerts";
import { lookupDcPledgePayment } from "@/lib/payments/divinitycoin/saved-cards";
import { confirmBalancePayment, findUnconfirmedBalancePayments, markBalanceSweepChecked } from "@/lib/indiekit/balance-confirm";
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
// How long a FAILED pledge stays in the sweep (a decline followed by a
// successful retry in the same checkout happens within minutes).
const FAILED_RECHECK_HOURS = 48;

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
    // FAILED is included: a decline followed by a successful retry inside
    // the same hosted checkout leaves the row FAILED with the money taken.
    // DC's verify-payment is the authority; a genuinely failed one stays put.
    // A FAILED row is only worth re-asking about while a retry inside the
    // same hosted checkout is still plausible. After two days it is a
    // decline, and re-verifying it every five minutes for a month would
    // eat the per-tick budget that PENDING rows need.
    const failedRecheckSince = new Date(Date.now() - FAILED_RECHECK_HOURS * 60 * 60 * 1000);
    const stuck = await db.pledge.findMany({
      where: {
        paymentProcessor: "DIVINITYCOIN",
        deletedAt: null,
        createdAt: { lt: newerThan, gte: olderThan },
        AND: [
          {
            OR: [
              { status: "PENDING" },
              { status: "FAILED", updatedAt: { gte: failedRecheckSince } },
            ],
          },
          {
            OR: [
              { NOT: { divinityCoinPaymentId: null } },
              { NOT: { divinityCoinCheckoutSessionId: null } },
            ],
          },
        ],
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        amount: true,
        confirmationEmailSent: true,
        divinityCoinPaymentId: true,
        divinityCoinCheckoutSessionId: true,
        user: { select: { email: true } },
        project: { select: { title: true } },
      },
      orderBy: { createdAt: "asc" },
      take: MAX_PLEDGES_PER_TICK,
    });

    let checked = 0;
    let committed = 0;
    let failedAtGateway = 0;
    let autoFailed = 0;
    let alreadyFailed = 0;
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
        // The session is the authority, not the intent already stamped on
        // the row: a backer whose first attempt was abandoned or declined
        // and who then paid inside the same checkout has a stale intent
        // here and the successful one on DC's session. Verifying the stale
        // one reads "pending" forever.
        let paymentIntentId = p.divinityCoinPaymentId;
        // DC's payment records answer "was this pledge paid" directly,
        // whichever of its sessions or intents did it. Prefer that over
        // the intent stamped on our row, which may be a dead sibling.
        const record = await lookupDcPledgePayment(p.id);
        // DC affirmatively says no attempt on this pledge ever succeeded
        // (it reads live processor status per attempt). Only with that in
        // hand is "failed" below allowed to mean anything.
        const dcSaysUnpaid = record.success && record.paid === false;
        if (record.success && record.paid && record.paymentIntentId) {
          if (record.paymentIntentId !== paymentIntentId) {
            paymentIntentId = record.paymentIntentId;
            await db.pledge.update({
              where: { id: p.id },
              data: {
                divinityCoinPaymentId: paymentIntentId,
                ...(record.sessionId ? { divinityCoinCheckoutSessionId: record.sessionId } : {}),
              },
            });
          }
        } else if (p.divinityCoinCheckoutSessionId) {
          const sessionResult = await getDcCheckoutSession(p.divinityCoinCheckoutSessionId);
          if (sessionResult.success && sessionResult.session.paymentIntentId) {
            // Only a COMPLETE session's intent outranks what is stamped
            // here. A session that is still "pending" may point at one of
            // several dead attempts while the stamped intent (set by hand,
            // or by the success webhook) is the one that was paid.
            const sessionIntent = sessionResult.session.paymentIntentId;
            const sessionComplete = sessionResult.session.status === "complete";
            if (sessionIntent !== paymentIntentId && (sessionComplete || !paymentIntentId)) {
              paymentIntentId = sessionIntent;
              await db.pledge.update({
                where: { id: p.id },
                data: { divinityCoinPaymentId: paymentIntentId },
              });
            }
          } else if (
            sessionResult.success &&
            (sessionResult.session.status === "expired" || sessionResult.session.status === "canceled") &&
            !paymentIntentId
          ) {
            // Never paid and the session is gone: nothing to recover.
            stillPending++;
            continue;
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
          if (p.status === "FAILED") {
            // We already knew. DC agreeing is not news and not a decision.
            alreadyFailed++;
            continue;
          }
          // PENDING here, failed/expired at DC. Once DC's expiry sweep
          // started cancelling abandoned sessions, every abandoned hosted
          // checkout of the last month verified as "failed" at once and
          // this branch paged the admins about 37 carts nobody needed to
          // look at. An uncounted PENDING pledge with no successful
          // attempt on DC's books is an abandoned cart: mark it FAILED
          // (reversible — handlePaymentSucceeded accepts FAILED if the
          // backer does come back and pay) and move on. Nothing to roll
          // back: it was never added to the campaign.
          if (!p.confirmationEmailSent && dcSaysUnpaid) {
            const cas = await db.pledge.updateMany({
              where: { id: p.id, status: "PENDING", deletedAt: null },
              data: {
                status: "FAILED",
                lastFailureReason: "Checkout was not completed (payment failed or expired at DivinityCoin)",
              },
            });
            if (cas.count > 0) {
              autoFailed++;
              log.info({ pledgeId: p.id, paymentIntentId }, "[Reconcile DC] Abandoned checkout marked FAILED");
            } else {
              stillPending++;
            }
            continue;
          }
          // Counted PENDING pledge (money was expected) or DC's records
          // were unreachable: a human needs to look.
          failedAtGateway++;
          gatewayFailures.push(
            `${p.user?.email ?? p.id} · $${Number(p.amount).toFixed(2)} · "${p.project?.title ?? "?"}"${p.confirmationEmailSent ? " · COUNTED in campaign total" : ""}${dcSaysUnpaid ? "" : " · DC records unreachable"}`
          );
          log.warn(
            { pledgeId: p.id, paymentIntentId, counted: p.confirmationEmailSent, dcSaysUnpaid },
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

    // Balance / shipping payments made through the pay link. Only the
    // browser's confirm call recorded these until the webhook learned to;
    // anything it missed is verified with the processor here.
    let balancesChecked = 0;
    let balancesConfirmed = 0;
    const balanceLines: string[] = [];
    try {
      const ids = await findUnconfirmedBalancePayments(100);
      for (const id of ids) {
        balancesChecked++;
        const r = await confirmBalancePayment({ pledgeId: id, source: "sweep" });
        if (r.status === "confirmed") {
          balancesConfirmed++;
          balanceLines.push(`${id} · $${(r.amount ?? 0).toFixed(2)}`);
        } else if (r.status === "error") {
          errored++;
        }
        if (r.status !== "confirmed") await markBalanceSweepChecked(id);
      }
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, "[Reconcile DC] balance sweep failed");
    }
    if (balancesConfirmed > 0) {
      log.info({ balancesConfirmed, balanceLines }, "[Reconcile DC] Confirmed balance payments the browser never reported");
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
        message: `DivinityCoin reports the payment failed, but the pledge is still PENDING here and was either already counted in the campaign total or could not be checked against DivinityCoin's records. Each needs a decision (Admin → Reconcile):\n\n${gatewayFailures.join("\n")}`,
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
      autoFailed,
      alreadyFailed,
      stillPending,
      balancesChecked,
      balancesConfirmed,
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
