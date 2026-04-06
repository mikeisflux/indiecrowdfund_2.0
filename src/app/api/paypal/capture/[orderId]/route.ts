import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPayPalConfig, getPayPalAccessToken } from "@/lib/payments/paypal";
import { captureAuthorizedPaypalPledgesAsync } from "@/lib/payments/paypal/capture-authorized";
import { claimRewardSlot, assignBackerNumber } from "@/lib/payments/stripe";
import { notifyPledgeReceived, notifyProjectFunded } from "@/lib/notifications";
import { sendPledgeConfirmationEmail, isEmailTypeEnabled } from "@/lib/email";
import { logger } from "@/lib/logger";

const paypalCaptureLogger = logger.child({ module: "paypal-capture" });

export const dynamic = "force-dynamic";

// POST - Capture an approved PayPal order and complete the pledge
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
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

    // Find the pledge for this PayPal order
    const pledge = await db.pledge.findUnique({
      where: { paypalOrderId: orderId },
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

    const config = await getPayPalConfig();
    const accessToken = await getPayPalAccessToken();

    // First fetch the order to determine its intent (CAPTURE vs AUTHORIZE)
    const orderDetailsRes = await fetch(`${config.baseUrl}/v2/checkout/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const orderDetails = orderDetailsRes.ok ? await orderDetailsRes.json() : null;
    const orderIntent = orderDetails?.intent as string | undefined;
    const isAuthorizeIntent = orderIntent === "AUTHORIZE";

    if (isAuthorizeIntent) {
      // Campaign not yet funded — authorize without capturing.
      // Funds are held on the backer's card; we capture when the goal is reached.
      const authorizeRes = await fetch(`${config.baseUrl}/v2/checkout/orders/${orderId}/authorize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `authorize_${pledge.id}`,
        },
      });

      if (!authorizeRes.ok) {
        const errBody = await authorizeRes.text();
        paypalCaptureLogger.error({ pledgeId: pledge.id, orderId, err: errBody }, "PayPal authorize failed");
        return NextResponse.json({ error: "Payment authorization failed. Please try again." }, { status: 502 });
      }

      const authorizeData = await authorizeRes.json();
      const authorizationId = authorizeData?.purchase_units?.[0]?.payments?.authorizations?.[0]?.id as string | undefined;

      if (!authorizationId) {
        paypalCaptureLogger.error({ pledgeId: pledge.id, orderId }, "PayPal authorize succeeded but no authorization ID found");
        return NextResponse.json({ error: "Authorization failed — no authorization ID returned." }, { status: 502 });
      }

      paypalCaptureLogger.info({ pledgeId: pledge.id, orderId, authorizationId }, "PayPal order authorized (deferred capture)");

      // Atomically claim the right to update stats using confirmationEmailSent flag.
      // This prevents double-counting if the endpoint is retried concurrently.
      const authClaimResult = await db.pledge.updateMany({
        where: { id: pledge.id, confirmationEmailSent: false },
        data: {
          paypalAuthorizationId: authorizationId,
          confirmationEmailSent: true,
        },
      });

      if (authClaimResult.count === 0) {
        // Already processed by a concurrent request
        paypalCaptureLogger.info({ pledgeId: pledge.id, orderId }, "PayPal authorization already processed (confirmationEmailSent already true)");
        return NextResponse.json({ success: true, message: "Authorization already processed" });
      }

      // Update project stats now (same as Stripe SetupIntent flow)
      const updatedProject = await db.project.update({
        where: { id: pledge.projectId },
        data: {
          currentAmount: { increment: Number(pledge.amount) },
          backerCount: { increment: 1 },
        },
      });

      if (pledge.reward?.id) {
        await claimRewardSlot(pledge.reward.id).catch(err =>
          paypalCaptureLogger.error({ err: String(err) }, "claimRewardSlot failed")
        );
      }

      try {
        backerNumber = await assignBackerNumber(pledge.projectId, pledge.id);
      } catch (err) {
        paypalCaptureLogger.error({ err: String(err) }, "Failed to assign backer number");
      }

      await notifyPledgeReceived(pledge.projectId, pledge.project.creatorId, pledge.user.name || "A backer", Number(pledge.amount)).catch(
        err => paypalCaptureLogger.error({ err: String(err) }, "notifyPledgeReceived failed")
      );

      const projectIsFunded = Number(updatedProject.currentAmount) >= Number(updatedProject.goalAmount);
      const justReachedGoal =
        projectIsFunded &&
        Number(updatedProject.currentAmount) - Number(pledge.amount) < Number(updatedProject.goalAmount);

      if (justReachedGoal) {
        await notifyProjectFunded(pledge.projectId).catch(err =>
          paypalCaptureLogger.error({ err: String(err) }, "notifyProjectFunded failed")
        );
        // Trigger capture of all authorized PayPal pledges (including this one)
        captureAuthorizedPaypalPledgesAsync(pledge.projectId);
      }

      // Send confirmation email (card authorized, not yet charged)
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
            false, // chargedImmediately = false — not charged yet
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
            pledge.id
          );
        } catch (emailErr) {
          paypalCaptureLogger.error({ err: String(emailErr) }, "Failed to send authorization confirmation email");
        }
      }

      return NextResponse.json({ success: true, pledgeId: pledge.id, authorized: true });
    }

    // CAPTURE intent — immediate charge (campaign already funded)
    const captureRes = await fetch(`${config.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `capture_${pledge.id}`,
      },
    });

    if (!captureRes.ok) {
      const errBody = await captureRes.text();
      paypalCaptureLogger.error({ pledgeId: pledge.id, orderId, err: errBody }, "PayPal capture failed");
      return NextResponse.json({ error: "Payment capture failed. Please try again." }, { status: 502 });
    }

    const captureData = await captureRes.json();
    const captureStatus = captureData.status;

    if (captureStatus !== "COMPLETED") {
      paypalCaptureLogger.warn({ pledgeId: pledge.id, orderId, captureStatus }, "PayPal capture not completed");
      return NextResponse.json({ error: "Payment was not completed by PayPal." }, { status: 400 });
    }

    paypalCaptureLogger.info({ pledgeId: pledge.id, orderId }, "PayPal order captured successfully");

    // Atomically mark as confirmed to prevent race conditions
    const confirmResult = await db.pledge.updateMany({
      where: { id: pledge.id, confirmationEmailSent: false },
      data: {
        status: "COMPLETED",
        confirmationEmailSent: true,
      },
    });

    if (confirmResult.count === 0) {
      // Already confirmed (webhook may have beaten us)
      return NextResponse.json({ success: true, alreadyCompleted: true });
    }

    // Update project stats
    const updatedProject = await db.project.update({
      where: { id: pledge.projectId },
      data: {
        currentAmount: { increment: Number(pledge.amount) },
        backerCount: { increment: 1 },
      },
    });

    // Claim reward slot atomically
    if (pledge.reward?.id) {
      const claimed = await claimRewardSlot(pledge.reward.id);
      if (!claimed) {
        paypalCaptureLogger.warn({ pledgeId: pledge.id }, "Reward sold out during PayPal capture");
      }
    }

    // Assign backer number
    try {
      backerNumber = await assignBackerNumber(pledge.projectId, pledge.id);
    } catch (err) {
      paypalCaptureLogger.error({ err: String(err) }, "Failed to assign backer number");
    }

    // Notify creator
    try {
      await notifyPledgeReceived(
        pledge.projectId,
        pledge.project.creatorId,
        pledge.user.name || "A backer",
        Number(pledge.amount)
      );
    } catch (err) {
      paypalCaptureLogger.error({ err: String(err) }, "Failed to notify creator");
    }

    // Check if project just hit funding goal
    const projectIsFunded = Number(updatedProject.currentAmount) >= Number(updatedProject.goalAmount);
    const justReachedGoal =
      projectIsFunded &&
      Number(updatedProject.currentAmount) - Number(pledge.amount) < Number(updatedProject.goalAmount);
    if (justReachedGoal) {
      try {
        await notifyProjectFunded(pledge.projectId);
      } catch (err) {
        paypalCaptureLogger.error({ err: String(err) }, "Failed to notify project funded");
      }
    }

    // Send confirmation email
    const pledgeEmailEnabled = await isEmailTypeEnabled("pledgeConfirmation");
    if (pledge.user.email && pledgeEmailEnabled) {
      const addonsForEmail = pledge.addons?.map((ae: { addon: { title: string; amount: unknown }; quantity: number }) => ({
        title: ae.addon.title,
        quantity: ae.quantity,
        amount: Number(ae.addon.amount) * ae.quantity,
      })) || [];

      const projectUrlPath = pledge.project.creator?.vanityUrl
        ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
        : undefined;

      // Parse shipping address from JSON field
      const rawAddr = pledge.shippingAddress as Record<string, string> | null;
      const shippingInfo = rawAddr ? {
        name: rawAddr.name || null,
        address: rawAddr.line1 || rawAddr.address1 || null,
        city: rawAddr.city || null,
        state: rawAddr.state || null,
        postalCode: rawAddr.postalCode || rawAddr.zip || null,
        country: rawAddr.country || null,
      } : null;

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
          pledge.id
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
            paypalCaptureLogger.error({ err: String(logErr) }, "Failed to log confirmation email");
          }
        }
      } catch (emailErr) {
        paypalCaptureLogger.error({ err: String(emailErr) }, "Failed to send confirmation email");
      }
    }

    return NextResponse.json({ success: true, pledgeId: pledge.id });
  } catch (error) {
    paypalCaptureLogger.error({ err: String(error) }, "PayPal capture error");
    return NextResponse.json({ error: "Failed to process payment" }, { status: 500 });
  }
}
