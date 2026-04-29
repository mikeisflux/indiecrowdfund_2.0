import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withCorrelation } from "@/lib/correlation";

const pledgesConfirmLogger = logger.child({ module: "pledges-confirm" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendPledgeConfirmationEmail, isEmailTypeEnabled } from "@/lib/email";
import {
  notifyPledgeReceived,
  notifyProjectFunded,
} from "@/lib/notifications";
import { processPendingPledgesForProject, getStripeInstance, claimRewardSlot, claimAddonSlots, assignBackerNumber } from "@/lib/payments/stripe";
import { captureAuthorizedPaypalPledgesAsync } from "@/lib/payments/paypal/capture-authorized";
import { getPayPalConfig, getPayPalAccessToken } from "@/lib/payments/paypal/config";

/**
 * POST /api/pledges/[pledgeId]/confirm
 *
 * Called by the frontend after successful checkout to:
 * 1. Confirm the pledge was completed (update project stats)
 * 2. Send the confirmation email (if not already sent)
 * 3. Notify creator of new pledge
 *
 * Updates stats for ALL pledge types:
 * - SetupIntent pledges: stats updated here (webhook is backup)
 * - PaymentIntent pledges: stats updated here after verifying payment succeeded
 *   (webhook also updates stats, but atomic confirmationEmailSent flag prevents double-counting)
 * - DivinityCoin pledges: stats updated here after verifying DC transaction exists
 *   (webhook also updates stats, but atomic confirmationEmailSent flag prevents double-counting)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  return withCorrelation(req, async (correlationId) => {
  try {
    pledgesConfirmLogger.info({ correlationId }, "Pledge confirmation request");
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;

    // Get the pledge with project, user, addons, and shipping info
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
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
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        reward: {
          select: {
            id: true,
            title: true,
            amount: true,
          },
        },
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

    // Verify the pledge belongs to the current user
    if (pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if already confirmed (prevent double-counting stats)
    if (pledge.confirmationEmailSent) {
      return NextResponse.json({
        success: true,
        message: "Pledge already confirmed",
        alreadyConfirmed: true,
      });
    }

    // ── VERIFY ACTUAL PAYMENT SUCCESS before counting anything ──
    // For chargedImmediately pledges (PaymentIntent / DC), we MUST verify
    // with Stripe/DC that the payment actually succeeded. Without this,
    // incomplete/abandoned payments get counted in project totals.

    let paymentMethodId = pledge.stripePaymentMethodId;
    let paymentVerified = false;

    if (pledge.chargedImmediately && pledge.paymentProcessor === "PAYPAL") {
      // PayPal: completed by /api/paypal/capture before this is called
      if (pledge.status === "COMPLETED") {
        paymentVerified = true;
        pledgesConfirmLogger.info(`[Confirm] PayPal pledge already completed for ${pledgeId}`);
      } else if (pledge.paypalOrderId) {
        // Order exists but not yet COMPLETED — verify with PayPal before trusting
        try {
          const paypalConfig = await getPayPalConfig();
          const paypalAccessToken = await getPayPalAccessToken();
          const paypalOrderRes = await fetch(`${paypalConfig.baseUrl}/v2/checkout/orders/${pledge.paypalOrderId}`, {
            headers: { Authorization: `Bearer ${paypalAccessToken}` },
          });
          if (paypalOrderRes.ok) {
            const paypalOrderData = await paypalOrderRes.json();
            if (paypalOrderData.status === "COMPLETED" || paypalOrderData.status === "APPROVED") {
              paymentVerified = true;
              pledgesConfirmLogger.info(`[Confirm] PayPal order ${pledge.paypalOrderId} verified as ${paypalOrderData.status} for pledge ${pledgeId}`);
            } else {
              pledgesConfirmLogger.warn(`[Confirm] PayPal order ${pledge.paypalOrderId} is in status '${paypalOrderData.status}' — not verified`);
              return NextResponse.json({ success: false, error: "PayPal payment not completed. Please try again." }, { status: 400 });
            }
          } else {
            pledgesConfirmLogger.warn(`[Confirm] Could not fetch PayPal order ${pledge.paypalOrderId} — status ${paypalOrderRes.status}`);
            return NextResponse.json({ success: false, error: "Could not verify PayPal payment. Please try again." }, { status: 400 });
          }
        } catch (paypalErr) {
          pledgesConfirmLogger.error({ err: String(paypalErr) }, `[Confirm] Failed to verify PayPal order for pledge ${pledgeId}:`);
          return NextResponse.json({ success: false, error: "Could not verify PayPal payment. Please try again." }, { status: 500 });
        }
      } else {
        return NextResponse.json({
          success: false,
          error: "PayPal payment not completed. Please try again.",
        }, { status: 400 });
      }
    } else if (pledge.chargedImmediately && pledge.paymentProcessor === "DIVINITYCOIN") {
      // DivinityCoin: check for a transaction record
      const dcTransaction = await db.divinityCoinTransaction.findFirst({
        where: { pledgeId, type: "PAYMENT" },
        select: { id: true },
      });
      if (dcTransaction) {
        paymentVerified = true;
        pledgesConfirmLogger.info(`[Confirm] DC payment verified for pledge ${pledgeId}`);
      } else if (pledge.divinityCoinPaymentId) {
        // Has a DC payment ID but no transaction yet — DC webhook may still be in-flight
        // Give it the benefit of the doubt for now; the webhook will handle stats
        paymentVerified = true;
        pledgesConfirmLogger.info(`[Confirm] DC payment ID present for pledge ${pledgeId}, assuming in-flight`);
      } else {
        return NextResponse.json({
          success: false,
          error: "Payment not completed. Please try again.",
        }, { status: 400 });
      }
    } else if (pledge.chargedImmediately && pledge.paymentProcessor === "NMI") {
      // KIA NMI: confirm-nmi already ran the sale via saleByPaymentToken
      // and stored the transaction id on the pledge. Treat the presence
      // of nmiTransactionId as proof of payment.
      if (pledge.nmiTransactionId) {
        paymentVerified = true;
        pledgesConfirmLogger.info(`[Confirm] NMI KIA pledge ${pledgeId} verified via transaction ${pledge.nmiTransactionId}`);
      } else {
        pledgesConfirmLogger.warn(`[Confirm] NMI chargedImmediately pledge ${pledgeId} has no nmiTransactionId — confirm-nmi did not complete`);
        return NextResponse.json({
          success: false,
          error: "Payment not completed. Please try again.",
        }, { status: 400 });
      }
    } else if (pledge.chargedImmediately && pledge.stripePaymentIntentId) {
      // Stripe PaymentIntent: verify the actual status with Stripe
      try {
        const stripeClient = await getStripeInstance();
        const paymentIntent = await stripeClient.paymentIntents.retrieve(pledge.stripePaymentIntentId);

        if (paymentIntent.status === "succeeded") {
          paymentVerified = true;
          paymentMethodId = typeof paymentIntent.payment_method === "string"
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id || paymentMethodId;
          pledgesConfirmLogger.info(`[Confirm] Stripe PaymentIntent verified succeeded for pledge ${pledgeId}`);
        } else if (paymentIntent.status === "processing") {
          // Still processing — let the webhook handle it when it completes
          paymentVerified = true;
          pledgesConfirmLogger.info(`[Confirm] Stripe PaymentIntent processing for pledge ${pledgeId}, will be finalized by webhook`);
        } else {
          // Payment is incomplete, requires_payment_method, canceled, etc.
          pledgesConfirmLogger.warn(`[Confirm] Stripe PaymentIntent status is '${paymentIntent.status}' for pledge ${pledgeId} — NOT counting`);
          return NextResponse.json({
            success: false,
            error: "Payment not completed. Please try again.",
          }, { status: 400 });
        }
      } catch (err) {
        pledgesConfirmLogger.error({ err: String(err) }, `[Confirm] Failed to verify PaymentIntent for pledge ${pledgeId}:`);
        return NextResponse.json({
          success: false,
          error: "Could not verify payment status. Please try again.",
        }, { status: 500 });
      }
    } else if (pledge.chargedImmediately) {
      // chargedImmediately but no PaymentIntent ID and no DC payment — incomplete
      pledgesConfirmLogger.warn(`[Confirm] chargedImmediately pledge ${pledgeId} has no payment reference — NOT counting`);
      return NextResponse.json({
        success: false,
        error: "Payment not completed. Please try again.",
      }, { status: 400 });
    } else if (pledge.paymentProcessor === "NMI") {
      // AoN NMI: confirm-nmi stored the card in the Customer Vault.
      // Charge will run via the charge-on-success cron when the
      // campaign hits its goal. Vault id presence = setup verified.
      if (!pledge.nmiCustomerVaultId) {
        pledgesConfirmLogger.warn(`[Confirm] NMI AoN pledge ${pledgeId} has no nmiCustomerVaultId — confirm-nmi did not complete`);
        return NextResponse.json({
          success: false,
          error: "Card not saved — checkout incomplete. Please try again.",
        }, { status: 400 });
      }
      pledgesConfirmLogger.info(`[Confirm] NMI AoN pledge ${pledgeId} verified via vault ${pledge.nmiCustomerVaultId}`);
    } else {
      // SetupIntent pledge: verify payment method was saved
      if (!paymentMethodId && pledge.stripeSetupIntentId) {
        try {
          const stripeClient = await getStripeInstance();
          const setupIntent = await stripeClient.setupIntents.retrieve(pledge.stripeSetupIntentId);

          if (setupIntent.status === "succeeded" && setupIntent.payment_method) {
            paymentMethodId = typeof setupIntent.payment_method === "string"
              ? setupIntent.payment_method
              : setupIntent.payment_method.id;

            // Save the payment method to the pledge
            await db.pledge.update({
              where: { id: pledgeId },
              data: { stripePaymentMethodId: paymentMethodId },
            });

            pledgesConfirmLogger.info(`[Confirm] Fetched payment method from Stripe for pledge ${pledgeId}`);
          }
        } catch (err) {
          pledgesConfirmLogger.error({ err: String(err) }, `[Confirm] Failed to fetch SetupIntent from Stripe:`);
        }
      }

      if (!paymentMethodId) {
        return NextResponse.json({
          success: false,
          error: "Payment method not saved - checkout incomplete. Please try again.",
        }, { status: 400 });
      }
    }

    // Atomically mark as confirmed using conditional update to prevent race conditions.
    // If two requests pass the check above simultaneously, only one will match the
    // WHERE clause (confirmationEmailSent: false) and actually update.
    const confirmResult = await db.pledge.updateMany({
      where: { id: pledgeId, confirmationEmailSent: false },
      data: { confirmationEmailSent: true },
    });

    if (confirmResult.count === 0) {
      // Another request already confirmed this pledge
      return NextResponse.json({
        success: true,
        message: "Pledge already confirmed",
        alreadyConfirmed: true,
      });
    }

    // Update project stats for ALL pledge types.
    // The atomic confirmationEmailSent check above prevents double-counting
    // even if the webhook also tries to update stats concurrently.
    let updatedProject = pledge.project;

    if (!pledge.chargedImmediately) {
      // SetupIntent pledge - update stats now that checkout is confirmed
      updatedProject = await db.project.update({
        where: { id: pledge.projectId },
        data: {
          currentAmount: { increment: Number(pledge.amount) },
          backerCount: { increment: 1 },
        },
      });

      // Atomically claim reward slot if pledge has a reward (prevents overselling)
      if (pledge.reward?.id) {
        const claimed = await claimRewardSlot(pledge.reward.id);
        if (!claimed) {
          pledgesConfirmLogger.warn(`[Confirm] Reward ${pledge.reward.id} sold out for pledge ${pledgeId}`);
        }
      }

      if (pledge.addons?.length) {
        await claimAddonSlots(
          pledge.addons.map((a: { addonId: string; quantity: number }) => ({ id: a.addonId, quantity: a.quantity }))
        ).catch(err =>
          pledgesConfirmLogger.error({ err: String(err) }, "claimAddonSlots failed (SetupIntent)")
        );
      }

      // Notify creator of new pledge
      await notifyPledgeReceived(
        pledge.projectId,
        pledge.project.creatorId,
        pledge.user.name || "A backer",
        pledge.amount
      );

      pledgesConfirmLogger.info(`[Confirm] Updated project stats for SetupIntent pledge ${pledgeId}: +$${pledge.amount}`);

      // Check if project just reached funding goal
      const projectIsFunded = Number(updatedProject.currentAmount) >= Number(updatedProject.goalAmount);
      const justReachedGoal = projectIsFunded &&
        Number(updatedProject.currentAmount) - Number(pledge.amount) < Number(updatedProject.goalAmount);

      if (justReachedGoal) {
        await notifyProjectFunded(pledge.projectId);
      }

      // Process all pending pledges if project is funded (charge saved cards + authorized PayPal)
      if (projectIsFunded) {
        pledgesConfirmLogger.info(`[Confirm] Project ${pledge.projectId} is funded, processing pending pledges...`);
        const chargeResults = await processPendingPledgesForProject(pledge.projectId);
        pledgesConfirmLogger.info(`[Confirm] Charged ${chargeResults.successful}/${chargeResults.total} pledges`);
        captureAuthorizedPaypalPledgesAsync(pledge.projectId);
      }
    } else if (paymentVerified) {
      // PaymentIntent or DC pledge — payment was verified above, update stats now.
      // The webhook may also try to update stats, but it will check confirmationEmailSent
      // (which we already set atomically above) and skip if already confirmed.
      updatedProject = await db.project.update({
        where: { id: pledge.projectId },
        data: {
          currentAmount: { increment: Number(pledge.amount) },
          backerCount: { increment: 1 },
        },
      });

      // Also mark the pledge as COMPLETED if the payment actually succeeded
      // (not just "processing" — leave processing ones for the webhook to finalize)
      if (pledge.stripePaymentIntentId) {
        try {
          const stripeClient = await getStripeInstance();
          const pi = await stripeClient.paymentIntents.retrieve(pledge.stripePaymentIntentId);
          if (pi.status === "succeeded") {
            await db.pledge.update({
              where: { id: pledgeId },
              data: {
                status: "COMPLETED",
                stripePaymentMethodId: typeof pi.payment_method === "string"
                  ? pi.payment_method
                  : pi.payment_method?.id || paymentMethodId,
              },
            });
            pledgesConfirmLogger.info(`[Confirm] Marked PaymentIntent pledge ${pledgeId} as COMPLETED`);
          }
        } catch {
          // Non-critical — webhook will handle status update
        }
      }

      // Atomically claim reward slot if pledge has a reward
      if (pledge.reward?.id) {
        const claimed = await claimRewardSlot(pledge.reward.id);
        if (!claimed) {
          pledgesConfirmLogger.warn(`[Confirm] Reward ${pledge.reward.id} sold out for pledge ${pledgeId}`);
        }
      }

      if (pledge.addons?.length) {
        await claimAddonSlots(
          pledge.addons.map((a: { addonId: string; quantity: number }) => ({ id: a.addonId, quantity: a.quantity }))
        ).catch(err =>
          pledgesConfirmLogger.error({ err: String(err) }, "claimAddonSlots failed (PaymentIntent/DC)")
        );
      }

      // Notify creator of new pledge
      try {
        await notifyPledgeReceived(
          pledge.projectId,
          pledge.project.creatorId,
          pledge.user.name || "A backer",
          pledge.amount
        );
      } catch (notifyError) {
        pledgesConfirmLogger.error({ err: String(notifyError) }, `[Confirm] Failed to notify creator for pledge ${pledgeId}:`);
      }

      pledgesConfirmLogger.info(`[Confirm] Updated project stats for chargedImmediately pledge ${pledgeId}: +$${pledge.amount}`);
    }

    // Assign backer number BEFORE sending confirmation email.
    // This ensures the email always includes the backer number.
    let assignedBackerNumber = pledge.backerNumber;
    if (!assignedBackerNumber) {
      try {
        assignedBackerNumber = await assignBackerNumber(pledge.projectId, pledgeId);
        pledgesConfirmLogger.info(`[Confirm] Assigned backer number #${assignedBackerNumber} to pledge ${pledgeId}`);
      } catch (bnError) {
        // Non-fatal — backer number is nice-to-have, don't block confirmation
        pledgesConfirmLogger.error({ err: String(bnError) }, `[Confirm] Failed to assign backer number for pledge ${pledgeId}:`);
      }
    }

    // Send confirmation email if user has email and feature is enabled
    // (pledge was already marked as confirmed above)
    let emailSent = false;
    const pledgeEmailEnabled = await isEmailTypeEnabled("pledgeConfirmation");

    if (pledge.user.email && pledgeEmailEnabled) {
      // Format addons for the email - convert Decimal amounts to numbers
      const addons = pledge.addons?.map((addonEntry: { quantity: number; addon: { title: string; amount: unknown } }) => ({
        title: addonEntry.addon.title,
        quantity: addonEntry.quantity,
        amount: Number(addonEntry.addon.amount) * addonEntry.quantity,
      })) || [];

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

      // Build project URL with vanity URL if available
      const projectUrlPath = pledge.project.creator?.vanityUrl
        ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
        : undefined;

      const emailResult = await sendPledgeConfirmationEmail(
        pledge.user.email,
        pledge.user.name || "Backer",
        pledge.project.title,
        pledge.project.slug,
        Number(pledge.amount),
        pledge.reward?.title || null,
        pledge.chargedImmediately,
        pledge.project.imageUrl,
        pledge.project.currency || "USD",
        addons,
        shippingInfo,
        projectUrlPath,
        Number(pledge.rewardAmount) || undefined,
        Number(pledge.shippingAmount) || undefined,
        pledge.paymentProcessor as "STRIPE" | "DIVINITYCOIN" | "PAYPAL",
        assignedBackerNumber,
        pledge.id
      );
      emailSent = emailResult.success;

      if (emailResult.success) {
        pledgesConfirmLogger.info(`[Confirm] Sent confirmation email for pledge ${pledgeId} to ${pledge.user.email}`);
        try {
          await db.emailLog.create({
            data: {
              userId: pledge.user.id,
              projectId: pledge.project.id,
              pledgeId,
              type: "PLEDGE_CONFIRMATION",
              subject: emailResult.subject,
              recipientEmail: pledge.user.email,
              htmlContent: emailResult.html,
            },
          });
        } catch (logErr) {
          pledgesConfirmLogger.error({ err: String(logErr) }, `[Confirm] Failed to log confirmation email for pledge ${pledgeId}:`);
        }
      } else {
        pledgesConfirmLogger.error({ err: String(emailResult.error) }, `[Confirm] Failed to send confirmation email for pledge ${pledgeId}:`);
      }
    } else if (!pledgeEmailEnabled) {
      pledgesConfirmLogger.info(`[Confirm] Pledge confirmation emails are disabled in settings`);
    }

    return NextResponse.json({
      success: true,
      emailSent,
      statsUpdated: true,
      message: "Pledge confirmed successfully",
    });
  } catch (error) {
    pledgesConfirmLogger.error({ err: String(error), correlationId }, "Failed to confirm pledge:");
    return NextResponse.json(
      { error: "Failed to confirm pledge" },
      { status: 500 }
    );
  }
  });
}
