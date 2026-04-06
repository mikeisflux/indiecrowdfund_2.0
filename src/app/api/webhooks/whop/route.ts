import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWhopConfig, verifyWhopWebhookSignature } from "@/lib/payments/whop";
import { claimRewardSlot, assignBackerNumber } from "@/lib/payments/stripe";
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
      case "payment.succeeded": {
        const data = event.data;
        // Whop passes metadata on the checkout config — find pledge by whopCheckoutId
        const checkoutConfigId = data?.checkout_configuration_id as string | undefined;
        const metadata = data?.metadata as Record<string, string> | undefined;
        const pledgeId = metadata?.pledgeId;

        if (!pledgeId) {
          whopWebhookLogger.warn({ data }, "payment.succeeded missing pledgeId in metadata");
          break;
        }

        const pledge = await db.pledge.findUnique({
          where: { id: pledgeId },
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
          },
        });

        if (!pledge || pledge.status === "COMPLETED") break;

        // Save Whop checkout config ID and payment ID for refunds
        const whopPaymentId = data?.id as string | undefined;
        const updateData: Record<string, string> = {};
        if (checkoutConfigId) updateData.whopCheckoutId = checkoutConfigId;
        if (whopPaymentId) updateData.whopPaymentId = whopPaymentId;
        if (Object.keys(updateData).length > 0) {
          await db.pledge.update({ where: { id: pledgeId }, data: updateData });
        }

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

      case "payment.failed": {
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

      case "payment.pending": {
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
          await db.pledge.updateMany({
            where: { id: pledgeId, status: "COMPLETED" },
            data: { status: "REFUNDED" },
          });
          whopWebhookLogger.info({ pledgeId }, "Whop refund created — pledge marked refunded");
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
