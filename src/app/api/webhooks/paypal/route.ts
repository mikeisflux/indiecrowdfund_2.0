import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPayPalConfig, getPayPalAccessToken } from "@/lib/payments/paypal";
import { claimRewardSlot, assignBackerNumber } from "@/lib/payments/stripe";
import { notifyPledgeReceived, notifyProjectFunded } from "@/lib/notifications";
import { logger } from "@/lib/logger";

const paypalWebhookLogger = logger.child({ module: "paypal-webhook" });

export const dynamic = "force-dynamic";

async function verifyPayPalWebhook(
  req: NextRequest,
  rawBody: string
): Promise<boolean> {
  try {
    const config = await getPayPalConfig();
    if (!config.webhookId) {
      // If no webhook ID configured, skip verification in dev mode
      paypalWebhookLogger.warn("PayPal webhook ID not configured, skipping verification");
      return true;
    }

    const transmissionId = req.headers.get("paypal-transmission-id") || "";
    const transmissionTime = req.headers.get("paypal-transmission-time") || "";
    const certUrl = req.headers.get("paypal-cert-url") || "";
    const authAlgo = req.headers.get("paypal-auth-algo") || "";
    const transmissionSig = req.headers.get("paypal-transmission-sig") || "";

    const accessToken = await getPayPalAccessToken();

    const verifyRes = await fetch(`${config.baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: config.webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    });

    if (!verifyRes.ok) return false;
    const result = await verifyRes.json();
    return result.verification_status === "SUCCESS";
  } catch (err) {
    paypalWebhookLogger.error({ err: String(err) }, "PayPal webhook verification error");
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const isValid = await verifyPayPalWebhook(req, rawBody);
  if (!isValid) {
    paypalWebhookLogger.warn("PayPal webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { event_type: string; resource: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  paypalWebhookLogger.info({ eventType: event.event_type }, "PayPal webhook received");

  try {
    switch (event.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED": {
        const resource = event.resource;
        const customId = resource.custom_id as string | undefined;
        if (!customId) break;

        // customId is the pledgeId
        const pledge = await db.pledge.findUnique({
          where: { id: customId },
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

        // Atomically mark as confirmed to prevent double-counting with /capture endpoint
        const result = await db.pledge.updateMany({
          where: { id: customId, confirmationEmailSent: false },
          data: { status: "COMPLETED", confirmationEmailSent: true },
        });

        if (result.count === 0) break; // Already handled

        const updatedProject = await db.project.update({
          where: { id: pledge.projectId },
          data: {
            currentAmount: { increment: pledge.amount },
            backerCount: { increment: 1 },
          },
        });

        if (pledge.rewardId) {
          await claimRewardSlot(pledge.rewardId).catch(err =>
            paypalWebhookLogger.error({ err: String(err) }, "claimRewardSlot failed")
          );
        }

        await assignBackerNumber(pledge.projectId, pledge.id).catch(err =>
          paypalWebhookLogger.error({ err: String(err) }, "assignBackerNumber failed")
        );

        await notifyPledgeReceived(pledge.projectId, pledge.project.creatorId, "A backer", pledge.amount).catch(
          err => paypalWebhookLogger.error({ err: String(err) }, "notifyPledgeReceived failed")
        );

        const projectIsFunded = Number(updatedProject.currentAmount) >= Number(updatedProject.goalAmount);
        const justReachedGoal =
          projectIsFunded &&
          Number(updatedProject.currentAmount) - Number(pledge.amount) < Number(updatedProject.goalAmount);
        if (justReachedGoal) {
          await notifyProjectFunded(pledge.projectId).catch(err =>
            paypalWebhookLogger.error({ err: String(err) }, "notifyProjectFunded failed")
          );
        }

        paypalWebhookLogger.info({ pledgeId: customId }, "PayPal capture completed via webhook");
        break;
      }

      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.REVERSED": {
        const resource = event.resource;
        const customId = resource.custom_id as string | undefined;
        if (!customId) break;

        await db.pledge.updateMany({
          where: { id: customId, status: "PENDING" },
          data: { status: "FAILED", lastFailureReason: `PayPal ${event.event_type}` },
        });

        paypalWebhookLogger.info({ pledgeId: customId, eventType: event.event_type }, "PayPal capture failed/reversed");
        break;
      }

      case "PAYMENT.CAPTURE.REFUNDED": {
        const resource = event.resource;
        const customId = resource.custom_id as string | undefined;
        if (!customId) break;

        await db.pledge.updateMany({
          where: { id: customId, status: "COMPLETED" },
          data: { status: "REFUNDED" },
        });

        paypalWebhookLogger.info({ pledgeId: customId }, "PayPal payment refunded");
        break;
      }

      case "PAYMENT.PAYOUTSBATCH.SUCCESS": {
        const resource = event.resource;
        const batchId = resource.payout_batch_id as string | undefined;
        if (!batchId) break;

        await db.payPalPayout.updateMany({
          where: { paypalBatchId: batchId },
          data: { status: "COMPLETED", completedAt: new Date() },
        });

        paypalWebhookLogger.info({ batchId }, "PayPal payout batch completed");
        break;
      }

      case "PAYMENT.PAYOUTSBATCH.DENIED": {
        const resource = event.resource;
        const batchId = resource.payout_batch_id as string | undefined;
        if (!batchId) break;

        await db.payPalPayout.updateMany({
          where: { paypalBatchId: batchId },
          data: { status: "FAILED", failedAt: new Date(), failureReason: "Payout batch denied by PayPal" },
        });

        paypalWebhookLogger.warn({ batchId }, "PayPal payout batch denied");
        break;
      }

      case "PAYMENT.PAYOUTS-ITEM.SUCCEEDED": {
        const resource = event.resource;
        const senderItemId = resource.payout_item?.sender_item_id as string | undefined;
        if (!senderItemId) break;

        await db.payPalPayout.updateMany({
          where: { id: senderItemId },
          data: { status: "COMPLETED", completedAt: new Date() },
        });

        paypalWebhookLogger.info({ payoutId: senderItemId }, "PayPal payout item succeeded");
        break;
      }

      case "PAYMENT.PAYOUTS-ITEM.FAILED": {
        const resource = event.resource;
        const senderItemId = resource.payout_item?.sender_item_id as string | undefined;
        const errorMessage = (resource.errors as { message?: string } | undefined)?.message || "Unknown error";
        if (!senderItemId) break;

        await db.payPalPayout.updateMany({
          where: { id: senderItemId },
          data: { status: "FAILED", failedAt: new Date(), failureReason: errorMessage },
        });

        paypalWebhookLogger.warn({ payoutId: senderItemId, errorMessage }, "PayPal payout item failed");
        break;
      }

      default:
        paypalWebhookLogger.info({ eventType: event.event_type }, "Unhandled PayPal webhook event");
    }
  } catch (err) {
    paypalWebhookLogger.error({ err: String(err), eventType: event.event_type }, "PayPal webhook handler error");
  }

  return NextResponse.json({ received: true });
}
