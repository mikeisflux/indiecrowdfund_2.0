import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getPayPalConnectConfig,
  getPayPalConnectAccessToken,
  captureAuthorizedPayPalConnectPledgesAsync,
} from "@/lib/payments/paypal-connect";
import { claimRewardSlot, claimAddonSlots, assignBackerNumber } from "@/lib/payments/rewards";
import { notifyPledgeReceived, notifyProjectFunded } from "@/lib/notifications";
import { sendPledgeConfirmationEmail, isEmailTypeEnabled } from "@/lib/email";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "paypal-connect-capture" });

export const dynamic = "force-dynamic";

// POST - Capture (or authorize) an approved PayPal Connect order and complete
// the pledge. Mirrors /api/paypal/capture but on the isolated Connect columns.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: "Order ID required" }, { status: 400 });
    }

    const pledge = await db.pledge.findFirst({
      where: { paypalConnectOrderId: orderId, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            currency: true,
            goalAmount: true,
            currentAmount: true,
            creatorId: true,
            creator: { select: { vanityUrl: true } },
          },
        },
        user: { select: { id: true, email: true, name: true } },
        reward: { select: { id: true, title: true, amount: true } },
        addons: {
          select: {
            addonId: true,
            quantity: true,
            addon: { select: { title: true, amount: true } },
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }
    if (pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (pledge.status === "COMPLETED") {
      return NextResponse.json({ success: true, alreadyCompleted: true });
    }
    if (pledge.status !== "PENDING") {
      return NextResponse.json({ error: "Pledge is not in a capturable state" }, { status: 400 });
    }

    let backerNumber: number | null = null;

    const config = await getPayPalConnectConfig();
    const accessToken = await getPayPalConnectAccessToken();
    const bnHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Partner-Attribution-Id": config.bnCode,
    };

    // Determine order intent (CAPTURE vs AUTHORIZE).
    const orderDetailsRes = await fetch(`${config.baseUrl}/v2/checkout/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const orderDetails = orderDetailsRes.ok ? await orderDetailsRes.json() : null;
    const isAuthorizeIntent = orderDetails?.intent === "AUTHORIZE";

    if (isAuthorizeIntent) {
      const authorizeRes = await fetch(`${config.baseUrl}/v2/checkout/orders/${orderId}/authorize`, {
        method: "POST",
        headers: { ...bnHeaders, "PayPal-Request-Id": `authorize_connect_${pledge.id}` },
      });

      if (!authorizeRes.ok) {
        const errBody = await authorizeRes.text();
        log.error({ pledgeId: pledge.id, orderId, err: errBody }, "PayPal Connect authorize failed");
        return NextResponse.json({ error: "Payment authorization failed. Please try again." }, { status: 502 });
      }

      const authorizeData = await authorizeRes.json();
      const authorizationId = authorizeData?.purchase_units?.[0]?.payments?.authorizations?.[0]?.id as
        | string
        | undefined;

      if (!authorizationId) {
        log.error({ pledgeId: pledge.id, orderId }, "PayPal Connect authorize succeeded but no authorization ID");
        return NextResponse.json({ error: "Authorization failed — no authorization ID returned." }, { status: 502 });
      }

      const authClaim = await db.pledge.updateMany({
        where: { id: pledge.id, confirmationEmailSent: false },
        data: { paypalConnectAuthorizationId: authorizationId, confirmationEmailSent: true },
      });
      if (authClaim.count === 0) {
        return NextResponse.json({ success: true, message: "Authorization already processed" });
      }

      const updatedProject = await db.project.update({
        where: { id: pledge.projectId },
        data: {
          currentAmount: { increment: Number(pledge.amount) },
          backerCount: { increment: 1 },
        },
      });

      if (pledge.reward?.id) {
        await claimRewardSlot(pledge.reward.id).catch((err) =>
          log.error({ err: String(err) }, "claimRewardSlot failed"),
        );
      }
      if (pledge.addons?.length) {
        await claimAddonSlots(
          pledge.addons.map((a: { addonId: string; quantity: number }) => ({ id: a.addonId, quantity: a.quantity })),
        ).catch((err) => log.error({ err: String(err) }, "claimAddonSlots failed"));
      }

      try {
        backerNumber = await assignBackerNumber(pledge.projectId, pledge.id);
      } catch (err) {
        log.error({ err: String(err) }, "Failed to assign backer number");
      }

      await notifyPledgeReceived(
        pledge.projectId,
        pledge.project.creatorId,
        pledge.user.name || "A backer",
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
        captureAuthorizedPayPalConnectPledgesAsync(pledge.projectId);
      }

      const pledgeEmailEnabled = await isEmailTypeEnabled("pledgeConfirmation");
      if (pledge.user.email && pledgeEmailEnabled) {
        try {
          await sendPledgeConfirmationEmail(
            pledge.user.email,
            pledge.user.name || "Backer",
            pledge.project.title,
            pledge.project.slug,
            Number(pledge.amount),
            pledge.reward?.title || null,
            false,
            pledge.project.imageUrl,
            pledge.project.currency || "USD",
            [],
            null,
            pledge.project.creator?.vanityUrl
              ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
              : undefined,
            undefined,
            undefined,
            "PAYPAL",
            backerNumber,
            pledge.id,
          );
        } catch (emailErr) {
          log.error({ err: String(emailErr) }, "Failed to send authorization confirmation email");
        }
      }

      return NextResponse.json({ success: true, pledgeId: pledge.id, authorized: true });
    }

    // CAPTURE intent — immediate charge (campaign already funded).
    const captureRes = await fetch(`${config.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: { ...bnHeaders, "PayPal-Request-Id": `capture_connect_${pledge.id}` },
    });

    if (!captureRes.ok) {
      const errBody = await captureRes.text();
      log.error({ pledgeId: pledge.id, orderId, err: errBody }, "PayPal Connect capture failed");
      return NextResponse.json({ error: "Payment capture failed. Please try again." }, { status: 502 });
    }

    const captureData = await captureRes.json();
    if (captureData.status !== "COMPLETED") {
      log.warn({ pledgeId: pledge.id, orderId, status: captureData.status }, "PayPal Connect capture not completed");
      return NextResponse.json({ error: "Payment was not completed by PayPal." }, { status: 400 });
    }

    const captureId = captureData?.purchase_units?.[0]?.payments?.captures?.[0]?.id as string | undefined;

    const confirmResult = await db.pledge.updateMany({
      where: { id: pledge.id, confirmationEmailSent: false },
      data: { status: "COMPLETED", confirmationEmailSent: true, paypalConnectCaptureId: captureId },
    });
    if (confirmResult.count === 0) {
      return NextResponse.json({ success: true, alreadyCompleted: true });
    }

    const updatedProject = await db.project.update({
      where: { id: pledge.projectId },
      data: {
        currentAmount: { increment: Number(pledge.amount) },
        backerCount: { increment: 1 },
      },
    });

    if (pledge.reward?.id) {
      const claimed = await claimRewardSlot(pledge.reward.id);
      if (!claimed) log.warn({ pledgeId: pledge.id }, "Reward sold out during PayPal Connect capture");
    }
    if (pledge.addons?.length) {
      await claimAddonSlots(
        pledge.addons.map((a: { addonId: string; quantity: number }) => ({ id: a.addonId, quantity: a.quantity })),
      ).catch((err) => log.error({ err: String(err) }, "claimAddonSlots failed"));
    }

    try {
      backerNumber = await assignBackerNumber(pledge.projectId, pledge.id);
    } catch (err) {
      log.error({ err: String(err) }, "Failed to assign backer number");
    }

    try {
      await notifyPledgeReceived(
        pledge.projectId,
        pledge.project.creatorId,
        pledge.user.name || "A backer",
        Number(pledge.amount),
      );
    } catch (err) {
      log.error({ err: String(err) }, "Failed to notify creator");
    }

    const projectIsFunded = Number(updatedProject.currentAmount) >= Number(updatedProject.goalAmount);
    const justReachedGoal =
      projectIsFunded &&
      Number(updatedProject.currentAmount) - Number(pledge.amount) < Number(updatedProject.goalAmount);
    if (justReachedGoal) {
      try {
        await notifyProjectFunded(pledge.projectId);
      } catch (err) {
        log.error({ err: String(err) }, "Failed to notify project funded");
      }
    }

    const pledgeEmailEnabled = await isEmailTypeEnabled("pledgeConfirmation");
    if (pledge.user.email && pledgeEmailEnabled) {
      const addonsForEmail =
        pledge.addons?.map((ae: { addon: { title: string; amount: unknown }; quantity: number }) => ({
          title: ae.addon.title,
          quantity: ae.quantity,
          amount: Number(ae.addon.amount) * ae.quantity,
        })) || [];

      const projectUrlPath = pledge.project.creator?.vanityUrl
        ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
        : undefined;

      const rawAddr = pledge.shippingAddress as Record<string, string> | null;
      const shippingInfo = rawAddr
        ? {
            name: rawAddr.name || null,
            address: rawAddr.line1 || rawAddr.address1 || null,
            city: rawAddr.city || null,
            state: rawAddr.state || null,
            postalCode: rawAddr.postalCode || rawAddr.zip || null,
            country: rawAddr.country || null,
          }
        : null;

      try {
        const emailResult = await sendPledgeConfirmationEmail(
          pledge.user.email,
          pledge.user.name || "Backer",
          pledge.project.title,
          pledge.project.slug,
          Number(pledge.amount),
          pledge.reward?.title || null,
          true,
          pledge.project.imageUrl,
          pledge.project.currency || "USD",
          addonsForEmail,
          shippingInfo,
          projectUrlPath,
          Number(pledge.rewardAmount) || undefined,
          Number(pledge.shippingAmount) || undefined,
          "PAYPAL",
          backerNumber,
          pledge.id,
        );

        if (emailResult.success) {
          try {
            await db.emailLog.create({
              data: {
                userId: pledge.user.id,
                projectId: pledge.project.id,
                pledgeId: pledge.id,
                type: "PLEDGE_CONFIRMATION",
                subject: emailResult.subject,
                recipientEmail: pledge.user.email,
                htmlContent: emailResult.html,
              },
            });
          } catch (logErr) {
            log.error({ err: String(logErr) }, "Failed to log confirmation email");
          }
        }
      } catch (emailErr) {
        log.error({ err: String(emailErr) }, "Failed to send confirmation email");
      }
    }

    return NextResponse.json({ success: true, pledgeId: pledge.id });
  } catch (error) {
    log.error({ err: formatError(error) }, "PayPal Connect capture error");
    return NextResponse.json({ error: "Failed to process payment" }, { status: 500 });
  }
}
