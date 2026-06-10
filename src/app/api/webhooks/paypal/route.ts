import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPayPalConfig, getPayPalAccessToken } from "@/lib/payments/paypal";
import { claimRewardSlot, claimAddonSlots, assignBackerNumber } from "@/lib/payments/rewards";
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
      if (process.env.NODE_ENV === "development") {
        paypalWebhookLogger.warn("PayPal webhook ID not configured, skipping verification (development only)");
        return true;
      }
      paypalWebhookLogger.error("PayPal webhook ID not configured — rejecting webhook in production");
      return false;
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

  let event: { id?: string; event_type: string; resource: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  paypalWebhookLogger.info({ eventType: event.event_type }, "PayPal webhook received");

  // Deduplicate using event ID (same pattern as Stripe webhook handler)
  const eventId = event.id
    ? `paypal_${event.id}`
    : `paypal_${req.headers.get("paypal-transmission-id") || Date.now()}`;

  const existingEvent = await db.processedWebhookEvent.findUnique({
    where: { eventId },
  });
  if (existingEvent) {
    paypalWebhookLogger.info({ eventId }, "Duplicate PayPal event ignored");
    return NextResponse.json({ received: true, duplicate: true });
  }
  try {
    await db.processedWebhookEvent.create({
      data: { eventId, eventType: event.event_type, source: "paypal" },
    });
  } catch {
    paypalWebhookLogger.info({ eventId }, "PayPal event already being processed");
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED": {
        const resource = event.resource;
        const customId = resource.custom_id as string | undefined;
        if (!customId) break;

        // customId is the pledgeId
        const pledge = await db.pledge.findFirst({
          where: { id: customId , deletedAt: null },
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
            currentAmount: { increment: Number(pledge.amount) },
            backerCount: { increment: 1 },
          },
        });

        if (pledge.rewardId) {
          await claimRewardSlot(pledge.rewardId).catch(err =>
            paypalWebhookLogger.error({ err: String(err) }, "claimRewardSlot failed")
          );
        }

        // Claim addon slots (prevents overselling limited addons)
        const pledgeAddons = await db.pledgeAddon.findMany({
          where: { pledgeId: pledge.id },
          select: { addonId: true, quantity: true },
        });
        if (pledgeAddons.length > 0) {
          const claimed = await claimAddonSlots(pledgeAddons.map((a: { addonId: string; quantity: number }) => ({ id: a.addonId, quantity: a.quantity }))).catch(err => {
            paypalWebhookLogger.error({ err: String(err) }, "claimAddonSlots failed");
            return false;
          });
          if (!claimed) {
            paypalWebhookLogger.warn(`[PayPal] One or more addons sold out for pledge ${pledge.id}`);
          }
        }

        await assignBackerNumber(pledge.projectId, pledge.id).catch(err =>
          paypalWebhookLogger.error({ err: String(err) }, "assignBackerNumber failed")
        );

        await notifyPledgeReceived(pledge.projectId, pledge.project?.creatorId ?? "", "A backer", Number(pledge.amount)).catch(
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

        // Load pledge details we need for the decrement amounts BEFORE
        // attempting the status CAS. This is purely informational — the
        // CAS below is what actually guards against double-processing.
        const refundedPledge = await db.pledge.findFirst({
          where: { id: customId, status: "COMPLETED", deletedAt: null },
          select: { id: true, projectId: true, amount: true, rewardId: true, confirmationEmailSent: true },
        });

        if (!refundedPledge) {
          paypalWebhookLogger.info({ pledgeId: customId }, "PayPal refund: pledge not found or not COMPLETED, skipping");
          break;
        }

        // Atomic compare-and-swap on status + stats decrement + reward
        // slot release, all in one transaction.
        //
        // Why a single transaction:
        //   - The CAS prevents two concurrent REFUNDED webhooks from
        //     both updating the pledge.
        //   - But without a transaction, the CAS commits, then the
        //     follow-up project.update / Reward update happen as
        //     separate writes -- a crash between them leaves the pledge
        //     marked REFUNDED with project.currentAmount and Reward
        //     quantityClaimed still counting the refunded backer. On
        //     PayPal redelivery the CAS now loses (status already
        //     REFUNDED), so the stats never get reconciled.
        //   - Wrapping them together means either the whole refund
        //     applies or none of it does, and the redelivery does the
        //     full job.
        const sideEffectsRan = await db.$transaction(async (tx) => {
          const refundCas = await tx.pledge.updateMany({
            where: { id: refundedPledge.id, status: "COMPLETED", deletedAt: null },
            data: { status: "REFUNDED" },
          });
          if (refundCas.count === 0) return false;

          if (refundedPledge.confirmationEmailSent) {
            await tx.project.update({
              where: { id: refundedPledge.projectId },
              data: {
                backerCount: { decrement: 1 },
                currentAmount: { decrement: Number(refundedPledge.amount) },
              },
            });
          }

          if (refundedPledge.rewardId) {
            await tx.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${refundedPledge.rewardId}`;
          }
          return true;
        });

        if (!sideEffectsRan) {
          paypalWebhookLogger.info(
            { pledgeId: customId },
            "PayPal refund: lost CAS (already REFUNDED by concurrent webhook), skipping side effects"
          );
        } else {
          paypalWebhookLogger.info({ pledgeId: customId }, "PayPal payment refunded — stats and reward slot updated");
        }
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
        const resource = event.resource as { payout_item?: { sender_item_id?: string } };
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
        const resource = event.resource as { payout_item?: { sender_item_id?: string }; errors?: { message?: string } };
        const senderItemId = resource.payout_item?.sender_item_id as string | undefined;
        const errorMessage = resource.errors?.message || "Unknown error";
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
