import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyChargeback } from "@/lib/payments/chargebacks";
import { unwindCountedPledge } from "@/lib/payments/unwind-counted-pledge";
import {
  getPayPalConnectConfig,
  getPayPalConnectAccessToken,
} from "@/lib/payments/paypal-connect";
import { claimRewardSlot, claimAddonSlots, assignBackerNumber } from "@/lib/payments/rewards";
import { notifyPledgeReceived, notifyProjectFunded } from "@/lib/notifications";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "paypal-connect-webhook" });

export const dynamic = "force-dynamic";

// Dedicated PayPal Connect webhook. Verifies against the Connect app's OWN
// webhook id and dedups under source "paypal-connect" — completely separate
// from the standard PayPal webhook at /api/webhooks/paypal.
async function verify(req: NextRequest, rawBody: string): Promise<boolean> {
  try {
    const config = await getPayPalConnectConfig();
    if (!config.webhookId) {
      log.error("PayPal Connect webhook ID not configured — rejecting webhook");
      return false;
    }

    const accessToken = await getPayPalConnectAccessToken();
    const verifyRes = await fetch(`${config.baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        transmission_id: req.headers.get("paypal-transmission-id") || "",
        transmission_time: req.headers.get("paypal-transmission-time") || "",
        cert_url: req.headers.get("paypal-cert-url") || "",
        auth_algo: req.headers.get("paypal-auth-algo") || "",
        transmission_sig: req.headers.get("paypal-transmission-sig") || "",
        webhook_id: config.webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    });

    if (!verifyRes.ok) return false;
    const result = await verifyRes.json();
    return result.verification_status === "SUCCESS";
  } catch (err) {
    log.error({ err: String(err) }, "PayPal Connect webhook verification error");
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verify(req, rawBody))) {
    log.warn("PayPal Connect webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { id?: string; event_type: string; resource: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  log.info({ eventType: event.event_type }, "PayPal Connect webhook received");

  // Dedup under a Connect-specific source + id namespace.
  const eventId = event.id
    ? `paypal_connect_${event.id}`
    : `paypal_connect_${req.headers.get("paypal-transmission-id") || Date.now()}`;

  // Read-only dedup — the processed marker is written after the handler
  // succeeds, so a transient failure gets redelivered instead of lost.
  const existing = await db.processedWebhookEvent.findUnique({ where: { eventId } });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.event_type) {
      // Onboarding events are gone with PayPal Connect onboarding — no new
      // merchant can be onboarded, so MERCHANT.ONBOARDING.COMPLETED and
      // MERCHANT.PARTNER-CONSENT.REVOKED have nothing to update. Payment
      // events below stay: captures and refunds on pledges taken before the
      // withdrawal still have to land.
      // ---- Payment events (custom_id = pledgeId) ----
      case "PAYMENT.CAPTURE.COMPLETED": {
        const resource = event.resource;
        const customId = resource.custom_id as string | undefined;
        const captureId = resource.id as string | undefined;
        if (!customId) break;

        const pledge = await db.pledge.findFirst({
          where: { id: customId, paymentProcessor: "PAYPAL_CONNECT", deletedAt: null },
          select: {
            id: true,
            status: true,
            projectId: true,
            amount: true,
            rewardId: true,
            project: { select: { creatorId: true, goalAmount: true, currentAmount: true } },
          },
        });
        if (!pledge || pledge.status === "COMPLETED") break;

        const result = await db.pledge.updateMany({
          where: { id: customId, confirmationEmailSent: false },
          data: { status: "COMPLETED", confirmationEmailSent: true, paypalConnectCaptureId: captureId },
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
          await claimRewardSlot(pledge.rewardId).catch((err: unknown) =>
            log.error({ err: String(err) }, "claimRewardSlot failed"),
          );
        }

        const pledgeAddons = await db.pledgeAddon.findMany({
          where: { pledgeId: pledge.id },
          select: { addonId: true, quantity: true },
        });
        if (pledgeAddons.length > 0) {
          await claimAddonSlots(
            pledgeAddons.map((a: { addonId: string; quantity: number }) => ({ id: a.addonId, quantity: a.quantity })),
          ).catch((err: unknown) => log.error({ err: String(err) }, "claimAddonSlots failed"));
        }

        await assignBackerNumber(pledge.projectId, pledge.id).catch((err: unknown) =>
          log.error({ err: String(err) }, "assignBackerNumber failed"),
        );

        await notifyPledgeReceived(
          pledge.projectId,
          pledge.project?.creatorId ?? "",
          "A backer",
          Number(pledge.amount),
        ).catch((err: unknown) => log.error({ err: String(err) }, "notifyPledgeReceived failed"));

        const projectIsFunded = Number(updatedProject.currentAmount) >= Number(updatedProject.goalAmount);
        const justReachedGoal =
          projectIsFunded &&
          Number(updatedProject.currentAmount) - Number(pledge.amount) < Number(updatedProject.goalAmount);
        if (justReachedGoal) {
          await notifyProjectFunded(pledge.projectId).catch((err: unknown) =>
            log.error({ err: String(err) }, "notifyProjectFunded failed"),
          );
        }

        log.info({ pledgeId: customId }, "PayPal Connect capture completed via webhook");
        break;
      }

      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.REVERSED": {
        const customId = event.resource.custom_id as string | undefined;
        if (!customId) break;

        const affected = await db.pledge.findFirst({
          where: { id: customId, deletedAt: null, paymentProcessor: "PAYPAL_CONNECT" },
          select: { id: true, status: true, projectId: true, amount: true, rewardId: true, confirmationEmailSent: true },
        });
        if (!affected) break;

        // Reversal of settled money = chargeback (see main PayPal webhook).
        if (affected.status === "COMPLETED" && event.event_type === "PAYMENT.CAPTURE.REVERSED") {
          const cb = await applyChargeback({
            pledgeId: affected.id,
            processor: "PayPal Connect",
            reason: "PAYMENT.CAPTURE.REVERSED",
          });
          log.warn({ pledgeId: affected.id, result: cb.message }, "PayPal Connect capture reversed on completed pledge — chargeback applied");
          break;
        }

        const deniedCas = await db.pledge.updateMany({
          where: { id: customId, status: "PENDING", paymentProcessor: "PAYPAL_CONNECT" },
          data: { status: "FAILED", lastFailureReason: `PayPal Connect ${event.event_type}` },
        });
        // A counted authorized pledge that is denied comes back out of the
        // campaign totals (this handler never unwound before).
        if (deniedCas.count > 0) {
          await unwindCountedPledge(affected);
        }
        log.info({ pledgeId: customId, eventType: event.event_type }, "PayPal Connect capture failed/reversed");
        break;
      }

      // PayPal chargebacks. A CUSTOMER.DISPUTE.* event names the disputed
      // capture (seller_transaction_id) and, when we set one, the pledge id
      // (custom). Until now no dispute event was handled at all, so PayPal
      // chargebacks never stopped an order the way DC/Whop disputes do.
      case "CUSTOMER.DISPUTE.CREATED":
      case "CUSTOMER.DISPUTE.UPDATED": {
        const d = event.resource as {
          dispute_id?: string;
          reason?: string;
          status?: string;
          seller_response_due_date?: string;
          disputed_transactions?: Array<{ seller_transaction_id?: string; custom?: string; custom_id?: string }>;
        };
        const tx0 = d.disputed_transactions?.[0];
        const customRef = tx0?.custom || tx0?.custom_id;
        const captureId = tx0?.seller_transaction_id;
        const or: Array<Record<string, string>> = [];
        if (customRef) or.push({ id: customRef });
        if (captureId) or.push({ paypalConnectCaptureId: captureId });
        if (or.length === 0) {
          log.warn({ disputeId: d.dispute_id }, "PayPal dispute event carried no transaction reference");
          break;
        }
        const disputed = await db.pledge.findFirst({
          where: { deletedAt: null, paymentProcessor: "PAYPAL_CONNECT", OR: or },
          select: { id: true },
        });
        if (!disputed) {
          log.warn({ disputeId: d.dispute_id, customRef, captureId }, "PayPal dispute did not match a pledge");
          break;
        }
        const cb = await applyChargeback({
          pledgeId: disputed.id,
          processor: "PayPal Connect",
          disputeId: d.dispute_id,
          reason: d.reason,
          disputeStatus: d.status,
          evidenceDueBy: d.seller_response_due_date,
        });
        log.warn({ pledgeId: disputed.id, result: cb.message }, "PayPal dispute applied as chargeback");
        break;
      }

      case "PAYMENT.CAPTURE.REFUNDED": {
        const customId = event.resource.custom_id as string | undefined;
        if (!customId) break;

        const refundedPledge = await db.pledge.findFirst({
          where: { id: customId, status: "COMPLETED", paymentProcessor: "PAYPAL_CONNECT", deletedAt: null },
          select: { id: true, projectId: true, amount: true, rewardId: true, confirmationEmailSent: true },
        });
        if (!refundedPledge) break;

        await db.$transaction(async (tx) => {
          const cas = await tx.pledge.updateMany({
            where: { id: refundedPledge.id, status: "COMPLETED", deletedAt: null },
            data: { status: "REFUNDED" },
          });
          if (cas.count === 0) return;
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
        });
        log.info({ pledgeId: customId }, "PayPal Connect payment refunded");
        break;
      }

      default:
        log.info({ eventType: event.event_type }, "Unhandled PayPal Connect webhook event");
    }
  } catch (err) {
    log.error({ err: String(err), eventType: event.event_type }, "PayPal Connect webhook handler error");
    // No processed marker written — 500 makes PayPal redeliver.
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }

  await db.processedWebhookEvent
    .create({ data: { eventId, eventType: event.event_type, source: "paypal-connect" } })
    .catch(() => {});

  return NextResponse.json({ received: true });
}
