import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getPayPalConnectConfig,
  getPayPalConnectAccessToken,
  syncPayPalConnectAccount,
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

  const existing = await db.processedWebhookEvent.findUnique({ where: { eventId } });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  try {
    await db.processedWebhookEvent.create({
      data: { eventId, eventType: event.event_type, source: "paypal-connect" },
    });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.event_type) {
      // ---- Onboarding events ----
      case "MERCHANT.ONBOARDING.COMPLETED": {
        const resource = event.resource;
        const trackingId = resource.tracking_id as string | undefined; // our userId
        const merchantId = resource.merchant_id as string | undefined;
        if (trackingId && merchantId) {
          await syncPayPalConnectAccount(trackingId, merchantId).catch((err) =>
            log.error({ err: String(err) }, "sync on onboarding completed failed"),
          );
          log.info({ trackingId, merchantId }, "PayPal Connect onboarding completed");
        }
        break;
      }

      case "MERCHANT.PARTNER-CONSENT.REVOKED": {
        const resource = event.resource;
        const merchantId = resource.merchant_id as string | undefined;
        if (merchantId) {
          await db.payPalConnectAccount.updateMany({
            where: { merchantIdInPayPal: merchantId },
            data: { onboardingStatus: "REVOKED", paymentsReceivable: false },
          });
          log.info({ merchantId }, "PayPal Connect consent revoked");
        }
        break;
      }

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
          await claimRewardSlot(pledge.rewardId).catch((err) =>
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
          ).catch((err) => log.error({ err: String(err) }, "claimAddonSlots failed"));
        }

        await assignBackerNumber(pledge.projectId, pledge.id).catch((err) =>
          log.error({ err: String(err) }, "assignBackerNumber failed"),
        );

        await notifyPledgeReceived(
          pledge.projectId,
          pledge.project?.creatorId ?? "",
          "A backer",
          Number(pledge.amount),
        ).catch((err) => log.error({ err: String(err) }, "notifyPledgeReceived failed"));

        const projectIsFunded = Number(updatedProject.currentAmount) >= Number(updatedProject.goalAmount);
        const justReachedGoal =
          projectIsFunded &&
          Number(updatedProject.currentAmount) - Number(pledge.amount) < Number(updatedProject.goalAmount);
        if (justReachedGoal) {
          await notifyProjectFunded(pledge.projectId).catch((err) =>
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
        await db.pledge.updateMany({
          where: { id: customId, status: "PENDING", paymentProcessor: "PAYPAL_CONNECT" },
          data: { status: "FAILED", lastFailureReason: `PayPal Connect ${event.event_type}` },
        });
        log.info({ pledgeId: customId, eventType: event.event_type }, "PayPal Connect capture failed/reversed");
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
  }

  return NextResponse.json({ received: true });
}
