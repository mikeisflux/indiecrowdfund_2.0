import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const cronProcessFundedCampaignsLogger = logger.child({ module: "cron-process-funded-campaigns" });
import { db } from "@/lib/db";
import { captureAuthorizedPaypalPledges } from "@/lib/payments/paypal";
import {
  chargeDcSavedPaymentMethod,
  verifyDcPayment,
  lookupDcPayment,
  handlePaymentSucceeded,
  formatDeclineReason,
  readDcChargeState,
  nextAttemptKey,
  withDcChargeState,
} from "@/lib/payments/divinitycoin";
import { distributeReadyFilesForProject } from "@/lib/fulfillment/auto-distribute";

// Charge all PENDING DivinityCoin pledges with a saved card (pm_...)
// for a project that has hit its goal. CAS-claim chargedImmediately
// false→true while still PENDING, run /charge-saved-payment-method
// off-session, then COMPLETE on success or roll back the claim +
// schedule a backoff retry on decline.
//
// Retries carry an explicit idempotencyKey. Without one, DC keys
// idempotency on pledgeId and Stripe replays the cached result for 24
// hours — declines included — so the 1h and 6h retries below never
// reached the bank at all and the 24h one landed on the boundary. A
// decline is a definitive answer and earns a fresh key; a network error
// is not an answer and must reuse the old one, or a retry could capture
// a second time on top of one that actually succeeded. See
// lib/payments/divinitycoin/charge-attempts.ts.
async function captureDcPendingPledges(projectId: string): Promise<{
  total: number;
  successful: number;
  failed: number;
}> {
  const result = { total: 0, successful: 0, failed: 0 };
  const pledges = await db.pledge.findMany({
    where: {
      projectId,
      status: "PENDING",
      paymentProcessor: "DIVINITYCOIN",
      chargedImmediately: false,
      deletedAt: null,
      NOT: { divinityCoinPaymentMethodId: null },
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: new Date() } },
      ],
    },
    select: {
      id: true,
      userId: true,
      amount: true,
      retryCount: true,
      metadata: true,
      divinityCoinPaymentMethodId: true,
      project: { select: { title: true } },
    },
  });

  const MAX_DC_RETRIES = 5;
  const BACKOFF_HOURS = [1, 6, 24, 72, 168];

  result.total = pledges.length;
  for (const p of pledges) {
    if (!p.divinityCoinPaymentMethodId) continue;

    // Atomic claim — concurrent cron runs see chargedImmediately=true
    // and skip without re-charging.
    const claimed = await db.pledge.updateMany({
      where: {
        id: p.id,
        status: "PENDING",
        chargedImmediately: false,
        divinityCoinPaymentId: null,
        deletedAt: null,
      },
      data: { chargedImmediately: true },
    });
    if (claimed.count === 0) {
      cronProcessFundedCampaignsLogger.info(
        { pledgeId: p.id },
        "[Cron] DC pledge already claimed by a concurrent worker; skipping"
      );
      continue;
    }

    const chargeState = readDcChargeState(p.metadata);

    // A previous attempt ended without a verdict, so we do not know whether
    // the card was charged. Ask DC before charging again: inside 24h the
    // idempotency key would have protected us, but past that Stripe has
    // pruned it and a blind retry captures a second time.
    if (chargeState.uncertainSince) {
      const lookup = await lookupDcPayment(p.id).catch(() => null);
      if (!lookup || !lookup.success) {
        // Still don't know. Release the claim and leave the uncertain flag
        // set so the next tick asks again — never fall through to a charge.
        cronProcessFundedCampaignsLogger.warn(
          { pledgeId: p.id, uncertainSince: chargeState.uncertainSince },
          "[Cron] Could not confirm a prior uncertain DC charge; deferring rather than retrying blind"
        );
        await db.pledge
          .updateMany({
            where: { id: p.id, status: "PENDING", divinityCoinPaymentId: null },
            data: { chargedImmediately: false, nextRetryAt: new Date(Date.now() + 60 * 60 * 1000) },
          })
          .catch(() => null);
        continue;
      }
      if (lookup.hasSuccessfulCharge) {
        if (!lookup.paymentIntentId) {
          // The money moved but DC gave us no PaymentIntent to record. We
          // must not charge again and cannot complete cleanly, so leave the
          // claim held (nothing else will touch it) and escalate.
          cronProcessFundedCampaignsLogger.error(
            { pledgeId: p.id },
            "[Cron] DC lookup-payment reports a successful charge with no PaymentIntent id — needs manual reconcile"
          );
          continue;
        }
        // Recovered: the earlier attempt did land. Finish it through the
        // webhook's completion path, which is CAS-guarded and idempotent.
        await handlePaymentSucceeded({ pledgeId: p.id, paymentId: lookup.paymentIntentId });
        await db.pledge
          .update({
            where: { id: p.id },
            data: {
              retryCount: 0,
              nextRetryAt: null,
              metadata: withDcChargeState(p.metadata, null),
            },
          })
          .catch(() => null);
        cronProcessFundedCampaignsLogger.info(
          { pledgeId: p.id, paymentIntentId: lookup.paymentIntentId },
          "[Cron] Recovered a DC charge whose response was lost; completed without re-charging"
        );
        result.successful++;
        continue;
      }
      // Definitively no charge landed — the earlier attempt is resolved, so
      // stop looking it up. The key itself is unchanged: that attempt was
      // never answered by the bank, so it does not count as a decline.
      chargeState.uncertainSince = undefined;
    }

    try {
      const charge = await chargeDcSavedPaymentMethod({
        platformUserId: p.userId,
        paymentMethodId: p.divinityCoinPaymentMethodId,
        amount: Math.round(Number(p.amount) * 100),
        currency: "usd",
        pledgeId: p.id,
        idempotencyKey: chargeState.attemptKey,
        projectId,
        description: `Pledge to ${p.project.title}`,
      });
      if (charge.success && charge.status === "succeeded" && charge.paymentIntentId) {
        await db.pledge.update({
          where: { id: p.id },
          data: {
            status: "COMPLETED",
            divinityCoinPaymentId: charge.paymentIntentId,
            retryCount: 0,
            nextRetryAt: null,
            metadata: withDcChargeState(p.metadata, null),
          },
        });
        result.successful++;
      } else {
        const newRetryCount = (p.retryCount || 0) + 1;
        const reason = formatDeclineReason({
          declineCode: charge.declineCode,
          code: charge.code,
          fallbackError: charge.error,
        });
        if (newRetryCount >= MAX_DC_RETRIES) {
          await db.pledge.update({
            where: { id: p.id },
            data: {
              status: "FAILED",
              chargedImmediately: false,
              retryCount: newRetryCount,
              nextRetryAt: null,
              lastFailureReason: `${reason} (after ${newRetryCount} attempts)`,
              // Terminal — nothing will retry, so drop the scaffolding.
              metadata: withDcChargeState(p.metadata, null),
            },
          });
        } else {
          const backoffHours = BACKOFF_HOURS[Math.min(newRetryCount - 1, BACKOFF_HOURS.length - 1)];
          const nextRetryAt = new Date(Date.now() + backoffHours * 60 * 60 * 1000);
          await db.pledge.update({
            where: { id: p.id },
            data: {
              chargedImmediately: false,
              retryCount: newRetryCount,
              nextRetryAt,
              lastFailureReason: reason,
              // The bank answered. Advance the key so the next attempt is a
              // real authorization rather than a replay of this decline.
              metadata: withDcChargeState(p.metadata, {
                attemptKey: nextAttemptKey(chargeState.attemptKey),
              }),
            },
          });
        }
        result.failed++;
      }
    } catch (err) {
      cronProcessFundedCampaignsLogger.error(
        { err: err instanceof Error ? err.message : String(err), pledgeId: p.id },
        "[Cron] DC charge error"
      );
      // Network / HTTP error: we never learned whether DC captured. Don't
      // mark FAILED. Hold the idempotency key exactly as it is — advancing
      // it here would turn a retry of a charge that may have succeeded into
      // a second, genuinely new authorization — and flag the pledge so the
      // next tick confirms via lookup-payment before charging again.
      const newRetryCount = (p.retryCount || 0) + 1;
      const backoffHours =
        BACKOFF_HOURS[Math.min(newRetryCount - 1, BACKOFF_HOURS.length - 1)];
      const nextRetryAt = new Date(Date.now() + backoffHours * 60 * 60 * 1000);
      await db.pledge
        .updateMany({
          where: { id: p.id, status: "PENDING", divinityCoinPaymentId: null },
          data: {
            chargedImmediately: false,
            retryCount: newRetryCount,
            nextRetryAt,
            metadata: withDcChargeState(p.metadata, {
              attemptKey: chargeState.attemptKey,
              uncertainSince: chargeState.uncertainSince ?? new Date().toISOString(),
            }),
          },
        })
        .catch(() => null);
      result.failed++;
    }
  }
  return result;
}

// Safety net for the immediate-charge flow. When an AoN campaign is
// funded (or KIA), new pledges charge at checkout and DC fires a
// payment.succeeded webhook that flips the pledge PENDING -> COMPLETED.
// If that webhook is ever missed or delayed, the pledge is stuck PENDING
// — already charged and counted by /confirm, but never COMPLETED and
// with no transaction record. This verifies such pledges directly
// against DC and finishes the ones that actually settled, reusing the
// exact webhook completion path so it stays idempotent.
async function verifyStuckDcImmediateCharges(
  projectId: string
): Promise<{ checked: number; completed: number }> {
  const result = { checked: 0, completed: 0 };
  // Lower bound: at least 10 minutes old, so the webhook has had a fair
  // shot at flipping the pledge first.
  // Upper bound: at most 24 hours old. A pledge whose PaymentIntent has
  // sat in DC's `pending` for a full day isn't a missed webhook —
  // it's an abandoned/in-limbo intent that will never resolve. Polling
  // it every 5 minutes forever pegs DC's verify-payment endpoint for
  // nothing (DC flagged ~40 calls/tick from this loop before this
  // bound). After 24h we let it go; manual reconcile picks it up.
  const newerThan = new Date(Date.now() - 10 * 60 * 1000);
  const olderThan = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stuck = await db.pledge.findMany({
    where: {
      projectId,
      status: "PENDING",
      paymentProcessor: "DIVINITYCOIN",
      chargedImmediately: true,
      deletedAt: null,
      NOT: { divinityCoinPaymentId: null },
      createdAt: { lt: newerThan, gte: olderThan },
    },
    select: { id: true, divinityCoinPaymentId: true },
    take: 100, // bound DC API calls per tick; the rest get the next tick
  });
  result.checked = stuck.length;
  for (const p of stuck) {
    if (!p.divinityCoinPaymentId) continue;
    try {
      const verified = await verifyDcPayment(p.divinityCoinPaymentId);
      if (!verified.success) continue; // transient — re-checked next tick
      if (verified.status === "succeeded") {
        // Reuse the webhook's completion path — idempotent + CAS-guarded,
        // so it's safe even if the real webhook lands moments later.
        await handlePaymentSucceeded({
          pledgeId: p.id,
          paymentId: p.divinityCoinPaymentId,
        });
        result.completed++;
        cronProcessFundedCampaignsLogger.info(
          { pledgeId: p.id },
          "[Cron] Completed a stuck immediate-charge DC pledge via verify-payment"
        );
      } else if (verified.status === "failed") {
        // A genuinely-failed charge stuck PENDING is rare here (it needs
        // both a missed payment.failed webhook and a /confirm that
        // optimistically counted it). Don't mutate from the cron — the
        // stats rollback is delicate; surface it loudly for manual review.
        cronProcessFundedCampaignsLogger.warn(
          { pledgeId: p.id, paymentIntentId: p.divinityCoinPaymentId },
          "[Cron] DC verify-payment reports FAILED for a stuck immediate-charge pledge — needs manual review"
        );
      }
      // "pending" — leave it; the cron re-checks next tick.
    } catch (err) {
      cronProcessFundedCampaignsLogger.error(
        { err: err instanceof Error ? err.message : String(err), pledgeId: p.id },
        "[Cron] DC payment verification error"
      );
    }
  }
  return result;
}

// Cron job endpoint for processing pending pledges on funded campaigns
//
// This actively checks for campaigns that have crossed their funding goal
// and processes all pending pledges (charges saved payment methods).
//
// This serves as an "event listener" that catches:
// - Campaigns that just reached their goal
// - Any missed webhook processing
// - Edge cases where pledges weren't charged
//
// Schedule: Every 5 minutes for responsive processing
// Vercel cron config in vercel.json: "schedule": "*/5 * * * *"
//
// Security: Protected by CRON_SECRET environment variable
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find funded projects that have pending pledges waiting to be charged
    // A project is "funded" when currentAmount >= goalAmount
    const fundedProjectsWithPendingPledges = await db.project.findMany({
      where: {
        status: { in: ["LIVE", "FUNDED"] },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        currentAmount: true,
        goalAmount: true,
        campaignType: true,
        paymentProcessor: true,
        _count: {
          select: {
            pledges: {
              where: {
                status: "PENDING",
                chargedImmediately: false,
                NOT: { divinityCoinPaymentMethodId: null },
              },
            },
          },
        },
      },
    });

    // Filter to only projects that are funded (or KEEP_IT_ALL) and have pending pledges
    const projectsToProcess = fundedProjectsWithPendingPledges.filter(
      (project) =>
        (project.campaignType === "KEEP_IT_ALL" || Number(project.currentAmount) >= Number(project.goalAmount)) &&
        project._count.pledges > 0
    );

    const results = {
      projectsChecked: fundedProjectsWithPendingPledges.length,
      projectsToProcess: projectsToProcess.length,
      processed: [] as {
        projectId: string;
        projectTitle: string;
        total: number;
        successful: number;
        failed: number;
        verifiedStuck?: number;
        verifiedCompleted?: number;
      }[],
      totalPledgesProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
    };

    // All funded projects get PayPal capture + DC saved-card capture.
    const fundedProjects = fundedProjectsWithPendingPledges.filter(
      (project) =>
        project.campaignType === "KEEP_IT_ALL" ||
        Number(project.currentAmount) >= Number(project.goalAmount)
    );

    for (const project of fundedProjects) {
      try {
        // Always capture authorized PayPal pledges (independent of DC)
        await captureAuthorizedPaypalPledges(project.id).catch(err =>
          cronProcessFundedCampaignsLogger.error({ err: String(err) }, `[Cron] PayPal capture error for project ${project.id}`)
        );

        // Charge any PENDING DivinityCoin saved cards (pm_...). DC AoN
        // campaigns save the card via SetupIntent at pledge time and
        // defer the off-session capture to here.
        const dcResults = await captureDcPendingPledges(project.id).catch((err) => {
          cronProcessFundedCampaignsLogger.error(
            { err: String(err) },
            `[Cron] DC capture error for project ${project.id}`
          );
          return { total: 0, successful: 0, failed: 0 };
        });

        // Safety net: finish any immediate-charge pledges that charged at
        // checkout but got stuck PENDING because their payment.succeeded
        // webhook was missed or delayed.
        const dcVerifyResults = await verifyStuckDcImmediateCharges(project.id).catch((err) => {
          cronProcessFundedCampaignsLogger.error(
            { err: String(err) },
            `[Cron] DC verify-stuck error for project ${project.id}`
          );
          return { checked: 0, completed: 0 };
        });

        // Post-close catch-up: as AoN pledges settle to COMPLETED here, deliver
        // any already-processed distribution rules to the newly-charged backers
        // (the campaign has closed, so the LIVE lock gate no longer applies).
        // Idempotent — backers who already have their files are skipped.
        await distributeReadyFilesForProject(project.id).catch((err) =>
          cronProcessFundedCampaignsLogger.error({ err: String(err) }, `[Cron] auto-distribute catch-up failed for ${project.id}`)
        );

        results.processed.push({
          projectId: project.id,
          projectTitle: project.title,
          ...dcResults,
          verifiedStuck: dcVerifyResults.checked,
          verifiedCompleted: dcVerifyResults.completed,
        });

        results.totalPledgesProcessed += dcResults.total;
        results.totalSuccessful += dcResults.successful + dcVerifyResults.completed;
        results.totalFailed += dcResults.failed;

        cronProcessFundedCampaignsLogger.info(`[Cron] Processed funded campaign "${project.title}": ${dcResults.successful}/${dcResults.total} saved-card charged, ${dcVerifyResults.completed}/${dcVerifyResults.checked} stuck immediate-charge completed`);
      } catch (error) {
        cronProcessFundedCampaignsLogger.error({ err: error }, `[Cron] Error processing pledges for project ${project.id}:`);
        results.processed.push({
          projectId: project.id,
          projectTitle: project.title,
          total: project._count.pledges,
          successful: 0,
          failed: project._count.pledges,
        });
        results.totalFailed += project._count.pledges;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    cronProcessFundedCampaignsLogger.error({ err: formatError(error) }, "Process funded campaigns cron error:");
    return NextResponse.json(
      { error: "Failed to process funded campaigns" },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(req: NextRequest) {
  return GET(req);
}
