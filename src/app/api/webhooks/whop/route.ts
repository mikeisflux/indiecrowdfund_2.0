import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWhopConfig, verifyWhopWebhookSignature } from "@/lib/payments/whop";
import { claimRewardSlot, claimAddonSlots, assignBackerNumber } from "@/lib/payments/rewards";
import { notifyPledgeReceived, notifyProjectFunded } from "@/lib/notifications";
import { logger } from "@/lib/logger";

const whopWebhookLogger = logger.child({ module: "whop-webhook" });

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify webhook signature — require secret to be configured; reject if missing
  try {
    const config = await getWhopConfig();
    if (!config.webhookSecret) {
      whopWebhookLogger.error("Whop webhook secret not configured — rejecting unauthenticated webhook");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }
    const signature = req.headers.get("whop-signature") || req.headers.get("x-whop-signature");
    const isValid = await verifyWhopWebhookSignature(rawBody, signature, config.webhookSecret);
    if (!isValid) {
      whopWebhookLogger.warn("Whop webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } catch (configErr) {
    whopWebhookLogger.error({ err: String(configErr) }, "Failed to load Whop config for webhook");
    return NextResponse.json({ error: "Config error" }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: { type: string; data: Record<string, any>; id?: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.type;
  const eventId = event.id;

  whopWebhookLogger.info({ eventType, eventId }, "Whop webhook received");

  // Idempotency check
  if (eventId) {
    const existing = await db.processedWebhookEvent.findFirst({
      where: { eventId, source: "whop" },
    });
    if (existing) {
      whopWebhookLogger.info({ eventId }, "Whop webhook already processed, skipping");
      return NextResponse.json({ received: true });
    }

    await db.processedWebhookEvent.create({
      data: { eventId, eventType, source: "whop" },
    });
  }

  try {
    switch (eventType) {
      case "payment.succeeded":
      case "payment_succeeded": {
        // Whop's webhook dashboard uses UNDERSCORE event names
        // (payment_succeeded). Our handler used DOT names (payment.succeeded)
        // which silently never matched -- every Whop payment hit the
        // default branch, our handler logged "Unhandled" and did nothing,
        // and the pledge stayed PENDING forever. Found Jun 15 when a
        // backer paid via Cash App, money landed at Whop, our DB stayed
        // PENDING, and he opened a refund case. Accept both forms so a
        // future Whop SDK rename can't break this again.
        const data = event.data;
        // Whop passes metadata on the checkout config — find pledge by whopCheckoutId
        const checkoutConfigId = data?.checkout_configuration_id as string | undefined;
        const metadata = data?.metadata as Record<string, string> | undefined;
        const pledgeId = metadata?.pledgeId;

        if (!pledgeId) {
          whopWebhookLogger.warn({ data }, "payment.succeeded missing pledgeId in metadata");
          break;
        }

        const pledge = await db.pledge.findFirst({
          where: { id: pledgeId , deletedAt: null },
          select: {
            id: true,
            status: true,
            confirmationEmailSent: true,
            projectId: true,
            amount: true,
            rewardId: true,
            project: {
              select: {
                creatorId: true,
                goalAmount: true,
                currentAmount: true,
              },
            },
            addons: {
              select: { addonId: true, quantity: true },
            },
          },
        });

        if (!pledge) break;

        // Always stamp the Whop checkout config ID + payment ID,
        // EVEN if the pledge is already COMPLETED. The /api/whop/
        // confirm/[pledgeId] route (fired by the browser when the
        // user lands on Whop's success URL) frequently marks the
        // pledge COMPLETED before this webhook arrives, and the
        // previous "break" on COMPLETED meant whopPaymentId never
        // got written for any browser-confirmed pledge -- breaking
        // refund / dispute / reconciliation lookups that key on it.
        // Use updateMany with a guard so we only set the field when
        // it's currently NULL (don't overwrite a different payment
        // id, e.g. if a partial-refund webhook reuses payment.id).
        const whopPaymentId = data?.id as string | undefined;
        if (checkoutConfigId) {
          await db.pledge.updateMany({
            where: { id: pledgeId, whopCheckoutId: null },
            data: { whopCheckoutId: checkoutConfigId },
          });
        }
        if (whopPaymentId) {
          await db.pledge.updateMany({
            where: { id: pledgeId, whopPaymentId: null },
            data: { whopPaymentId },
          });
        }

        // Now short-circuit the rest of the side-effects (project
        // amount increment, reward slot claim, confirmation email,
        // backer notification) if the pledge was already marked
        // COMPLETED by the browser confirm path. Those operations
        // are idempotent-by-design through the confirmationEmailSent
        // guard below, but bailing out here is cheaper and matches
        // pre-fix behavior for the already-confirmed case.
        if (pledge.status === "COMPLETED") break;

        // Atomically mark as confirmed
        const result = await db.pledge.updateMany({
          where: { id: pledgeId, confirmationEmailSent: false },
          data: { status: "COMPLETED", confirmationEmailSent: true },
        });

        if (result.count === 0) break;

        const updatedProject = await db.project.update({
          where: { id: pledge.projectId },
          data: {
            currentAmount: { increment: Number(pledge.amount) },
            backerCount: { increment: 1 },
          },
        });

        if (pledge.rewardId) {
          await claimRewardSlot(pledge.rewardId).catch(err =>
            whopWebhookLogger.error({ err: String(err) }, "claimRewardSlot failed")
          );
        }

        if (pledge.addons?.length) {
          await claimAddonSlots(
            pledge.addons.map((a: { addonId: string; quantity: number }) => ({ id: a.addonId, quantity: a.quantity }))
          ).catch(err =>
            whopWebhookLogger.error({ err: String(err) }, "claimAddonSlots failed")
          );
        }

        await assignBackerNumber(pledge.projectId, pledge.id).catch(err =>
          whopWebhookLogger.error({ err: String(err) }, "assignBackerNumber failed")
        );

        await notifyPledgeReceived(pledge.projectId, pledge.project.creatorId, "A backer", Number(pledge.amount)).catch(
          err => whopWebhookLogger.error({ err: String(err) }, "notifyPledgeReceived failed")
        );

        const projectIsFunded = Number(updatedProject.currentAmount) >= Number(updatedProject.goalAmount);
        const justReachedGoal =
          projectIsFunded &&
          Number(updatedProject.currentAmount) - Number(pledge.amount) < Number(updatedProject.goalAmount);

        if (justReachedGoal) {
          await notifyProjectFunded(pledge.projectId).catch(err =>
            whopWebhookLogger.error({ err: String(err) }, "notifyProjectFunded failed")
          );
        }

        whopWebhookLogger.info({ pledgeId }, "Whop payment succeeded — pledge confirmed");
        break;
      }

      case "payment.failed":
      case "payment_failed": {
        const data = event.data;
        const metadata = data?.metadata as Record<string, string> | undefined;
        const pledgeId = metadata?.pledgeId;

        if (!pledgeId) break;

        await db.pledge.updateMany({
          where: { id: pledgeId, status: "PENDING" },
          data: { status: "FAILED", lastFailureReason: "Whop payment failed" },
        });

        whopWebhookLogger.info({ pledgeId }, "Whop payment failed — pledge marked failed");
        break;
      }

      case "payment.pending":
      case "payment_pending": {
        const data = event.data;
        const metadata = data?.metadata as Record<string, string> | undefined;
        const pledgeId = metadata?.pledgeId;

        whopWebhookLogger.info({ pledgeId }, "Whop payment pending");
        break;
      }

      case "payment_created": {
        const data = event.data;
        const metadata = data?.metadata as Record<string, string> | undefined;
        const pledgeId = metadata?.pledgeId;
        whopWebhookLogger.info({ pledgeId }, "Whop payment created");
        break;
      }

      case "refund_created":
      case "refund_updated": {
        const data = event.data;
        const metadata = data?.metadata as Record<string, string> | undefined;
        const pledgeId = metadata?.pledgeId;

        if (!pledgeId) break;

        if (eventType === "refund_created") {
          // Load pledge details BEFORE the CAS — this is informational.
          // The CAS below is what actually guards against double-processing.
          const refundedPledge = await db.pledge.findFirst({
            where: { id: pledgeId, status: "COMPLETED", deletedAt: null },
            select: { id: true, projectId: true, amount: true, rewardId: true, confirmationEmailSent: true },
          });

          if (refundedPledge) {
            // Atomic compare-and-swap on status. Whop webhooks can be
            // retried on any 5xx response, so two concurrent refund_created
            // events for the same pledge could both pass the findFirst,
            // both update status to REFUNDED, and both decrement stats +
            // reward quantityClaimed — double-counting the refund.
            const refundCas = await db.pledge.updateMany({
              where: {
                id: refundedPledge.id,
                status: "COMPLETED",
                deletedAt: null,
              },
              data: { status: "REFUNDED" },
            });

            if (refundCas.count === 0) {
              whopWebhookLogger.info(
                { pledgeId },
                "Whop refund: lost CAS (already REFUNDED by concurrent webhook), skipping side effects"
              );
              break;
            }

            if (refundedPledge.confirmationEmailSent) {
              await db.project.update({
                where: { id: refundedPledge.projectId },
                data: {
                  backerCount: { decrement: 1 },
                  currentAmount: { decrement: Number(refundedPledge.amount) },
                },
              });
            }

            if (refundedPledge.rewardId) {
              await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${refundedPledge.rewardId}`;
            }
          }

          whopWebhookLogger.info({ pledgeId }, "Whop refund created — pledge marked refunded, stats updated");
        } else {
          whopWebhookLogger.info({ pledgeId, eventType }, "Whop refund updated");
        }
        break;
      }

      case "dispute_created": {
        const data = event.data;
        const metadata = data?.metadata as Record<string, string> | undefined;
        const pledgeId = metadata?.pledgeId;
        whopWebhookLogger.warn({ pledgeId, eventType }, "Whop dispute created");
        break;
      }

      case "dispute_updated": {
        const data = event.data;
        const metadata = data?.metadata as Record<string, string> | undefined;
        const pledgeId = metadata?.pledgeId;
        whopWebhookLogger.warn({ pledgeId, eventType }, "Whop dispute updated");
        break;
      }

      case "dispute_alert_created": {
        whopWebhookLogger.warn({ eventType }, "Whop dispute alert created");
        break;
      }

      case "invoice_paid": {
        whopWebhookLogger.info({ eventType }, "Whop invoice paid");
        break;
      }

      case "invoice_created":
      case "invoice_marked_uncollectible":
      case "invoice_past_due":
      case "invoice_voided": {
        whopWebhookLogger.info({ eventType }, `Whop invoice event: ${eventType}`);
        break;
      }

      case "membership_activated":
      case "membership_deactivated":
      case "membership_cancel_at_period_end_changed": {
        whopWebhookLogger.info({ eventType }, `Whop membership event: ${eventType}`);
        break;
      }

      case "withdrawal_created":
      case "withdrawal_updated": {
        whopWebhookLogger.info({ eventType }, `Whop withdrawal event: ${eventType}`);
        break;
      }

      case "payout_method_created": {
        whopWebhookLogger.info({ eventType }, "Whop payout method created");
        break;
      }

      case "payout_account_status_updated": {
        whopWebhookLogger.info({ eventType }, "Whop payout account status updated");
        break;
      }

      case "verification_succeeded": {
        whopWebhookLogger.info({ eventType }, "Whop identity verification succeeded");
        break;
      }

      case "setup_intent_requires_action":
      case "setup_intent_succeeded":
      case "setup_intent_canceled": {
        whopWebhookLogger.info({ eventType }, `Whop setup intent event: ${eventType}`);
        break;
      }

      case "entry_created":
      case "entry_approved":
      case "entry_denied":
      case "entry_deleted": {
        whopWebhookLogger.info({ eventType }, `Whop entry event: ${eventType}`);
        break;
      }

      case "course_lesson_interaction_completed": {
        whopWebhookLogger.info({ eventType }, "Whop course lesson interaction completed");
        break;
      }

      case "resolution_center_case_created":
      case "resolution_center_case_updated":
      case "resolution_center_case_decided": {
        whopWebhookLogger.warn({ eventType }, `Whop resolution center event: ${eventType}`);
        break;
      }

      default:
        whopWebhookLogger.info({ eventType }, "Unhandled Whop webhook event type");
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    whopWebhookLogger.error({ err: String(err), eventType }, "Error processing Whop webhook");
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}
