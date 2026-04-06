import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminPledgesLogger = logger.child({ module: "admin-pledges" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance, safeCancelSetupIntent, safeCancelPaymentIntent } from "@/lib/payments/stripe";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";
import { getPayPalConfig, getPayPalAccessToken } from "@/lib/payments/paypal";
import { sendPledgeConfirmationEmail } from "@/lib/email";
import { isAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// GET - Get pledge details (admin)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { pledgeId } = await params;

    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            currentAmount: true,
            goalAmount: true,
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
          include: {
            addon: {
              select: {
                id: true,
                title: true,
                amount: true,
              },
            },
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const isFunded = Number(pledge.project.currentAmount) >= Number(pledge.project.goalAmount) || pledge.project.status === "FUNDED";

    return NextResponse.json({
      pledge: {
        id: pledge.id,
        amount: Number(pledge.amount),
        status: pledge.status,
        createdAt: pledge.createdAt,
        stripePaymentIntentId: pledge.stripePaymentIntentId,
        stripeSetupIntentId: pledge.stripeSetupIntentId,
        user: pledge.user,
        project: {
          ...pledge.project,
          currentAmount: Number(pledge.project.currentAmount),
          goalAmount: Number(pledge.project.goalAmount),
        },
        reward: pledge.reward ? {
          ...pledge.reward,
          amount: Number(pledge.reward.amount),
        } : null,
        addons: pledge.addons.map((a: { addon: { id: string; title: string; amount: number }; quantity: number }) => ({
          id: a.addon.id,
          title: a.addon.title,
          amount: Number(a.addon.amount),
          quantity: a.quantity,
        })),
        canCancel: pledge.status === "PENDING",
        canRefund: pledge.status === "COMPLETED" && (
          !!pledge.stripePaymentIntentId ||
          pledge.paymentProcessor === "DIVINITYCOIN" ||
          pledge.paymentProcessor === "PAYPAL" ||
          pledge.paymentProcessor === "WHOP"
        ),
        isFunded,
      },
    });
  } catch (error) {
    adminPledgesLogger.error({ err: String(error) }, "Admin get pledge error:");
    return NextResponse.json(
      { error: "Failed to fetch pledge" },
      { status: 500 }
    );
  }
}

// PATCH - Cancel or refund pledge (admin)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { pledgeId } = await params;
    const body = await req.json();
    const { action, reason } = body;

    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            currentAmount: true,
            goalAmount: true,
            imageUrl: true,
            currency: true,
          },
        },
        reward: {
          select: {
            id: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });


    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    // Resend receipt email
    if (action === "resend_receipt") {
      if (!pledge.user.email) {
        return NextResponse.json(
          { error: "User has no email address" },
          { status: 400 }
        );
      }

      // Determine if charged immediately based on pledge status
      const chargedImmediately = pledge.status === "COMPLETED";

      try {
        const result = await sendPledgeConfirmationEmail(
          pledge.user.email,
          pledge.user.name || "Backer",
          pledge.project.title,
          pledge.project.slug,
          pledge.amount,
          pledge.reward?.title || null,
          chargedImmediately,
          pledge.project.imageUrl,
          pledge.project.currency || "USD",
          [], // addons
          undefined, // shippingInfo
          undefined, // projectUrlPath
          undefined, // rewardAmount
          undefined, // shippingAmount
          undefined, // paymentMethod
          pledge.backerNumber,
          pledge.id
        );

        if (result.success) {
          return NextResponse.json({
            success: true,
            message: `Receipt email sent to ${pledge.user.email}`,
          });
        } else {
          return NextResponse.json(
            { error: result.error || "Failed to send receipt email" },
            { status: 500 }
          );
        }
      } catch (emailError) {
        adminPledgesLogger.error({ err: String(emailError) }, "Error sending receipt email:");
        return NextResponse.json(
          { error: "Failed to send receipt email" },
          { status: 500 }
        );
      }
    }

    if (action === "cancel") {
      // Cancel a PENDING pledge (before charging)
      if (pledge.status !== "PENDING") {
        return NextResponse.json(
          { error: "Can only cancel pending pledges. Use refund for completed pledges." },
          { status: 400 }
        );
      }

      const stripe = await getStripeInstance();

      // Cancel any Stripe intents (safely checks status first)
      if (pledge.stripeSetupIntentId) {
        await safeCancelSetupIntent(stripe, pledge.stripeSetupIntentId);
      }
      if (pledge.stripePaymentIntentId) {
        await safeCancelPaymentIntent(stripe, pledge.stripePaymentIntentId);
      }

      // CRITICAL: Detach the payment method to prevent cron from charging it
      // This is necessary because SetupIntents that already succeeded can't be "cancelled"
      // but the payment method remains valid and the cron would charge it
      if (pledge.stripePaymentMethodId) {
        try {
          await stripe.paymentMethods.detach(pledge.stripePaymentMethodId);
          adminPledgesLogger.info(`[Admin Cancel] Detached payment method ${pledge.stripePaymentMethodId} for pledge ${pledgeId}`);
        } catch (detachError) {
          // Log but continue - payment method might already be detached or invalid
          adminPledgesLogger.warn(`[Admin Cancel] Could not detach payment method: ${detachError}`);
        }
      }

      // Update pledge status and CLEAR the payment method ID to prevent any charging
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "CANCELLED",
          lastFailureReason: reason || "Cancelled by admin",
          stripePaymentMethodId: null, // Clear to prevent cron from charging
        },
      });

      // Only decrement project stats if pledge was counted (confirmationEmailSent is the atomic flag)
      if (pledge.confirmationEmailSent) {
        await db.project.update({
          where: { id: pledge.projectId },
          data: {
            backerCount: { decrement: 1 },
            currentAmount: { decrement: Number(pledge.amount) },
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Pledge cancelled successfully",
      });
    }

    if (action === "refund") {
      // Refund a COMPLETED pledge
      if (pledge.status !== "COMPLETED") {
        return NextResponse.json(
          { error: "Can only refund completed pledges" },
          { status: 400 }
        );
      }

      if (pledge.paymentProcessor === "DIVINITYCOIN") {
        // DivinityCoin refund - call DC API to process Stripe refund on their end
        try {
          const refundAmount = Number(pledge.amount);

          const dcResult = await callDivinityCoinAPI("refund", {
            pledgeId: pledge.id,
            paymentId: pledge.divinityCoinPaymentId,
            amount: Math.round(refundAmount * 100), // cents
            reason: reason || "Refunded by admin",
            requestedBy: "admin",
          });

          if (!dcResult.success) {
            adminPledgesLogger.error({ err: String(dcResult.error) }, `[Admin DivinityCoin Refund] DC API refund failed for pledge ${pledgeId}:`);
            return NextResponse.json(
              { error: dcResult.error || "DivinityCoin refund failed" },
              { status: 400 }
            );
          }

          // Update pledge and project
          await db.$transaction(async (tx) => {
            await tx.divinityCoinTransaction.create({
              data: {
                userId: pledge.user.id,
                pledgeId: pledge.id,
                amount: -refundAmount,
                type: "REFUND",
                description: `Refund for pledge on "${pledge.project.title}" (admin)`,
                metadata: JSON.stringify({
                  adminUserId: session.user.id,
                  reason: reason || "Refunded by admin",
                  divinityCoinPaymentId: pledge.divinityCoinPaymentId,
                  dcRefundResult: dcResult.data,
                  processedAt: new Date().toISOString(),
                }),
              },
            });

            await tx.pledge.update({
              where: { id: pledgeId },
              data: {
                status: "REFUNDED",
                lastFailureReason: reason || "Refunded by admin",
              },
            });

            await tx.project.update({
              where: { id: pledge.projectId },
              data: {
                backerCount: { decrement: 1 },
                currentAmount: { decrement: Number(pledge.amount) },
              },
            });
          });

          // Restore reward slot if pledge claimed one
          if (pledge.reward?.id) {
            await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.reward.id}`;
          }

          return NextResponse.json({
            success: true,
            message: "DivinityCoin refund processed successfully",
          });
        } catch (dcError) {
          adminPledgesLogger.error({ err: String(dcError) }, "DivinityCoin admin refund error:");
          return NextResponse.json(
            { error: "Failed to process DivinityCoin refund" },
            { status: 500 }
          );
        }
      }

      // PayPal refund
      if (pledge.paymentProcessor === "PAYPAL") {
        if (!pledge.paypalOrderId) {
          return NextResponse.json(
            { error: "No PayPal order ID found to refund" },
            { status: 400 }
          );
        }

        try {
          const config = await getPayPalConfig();
          const accessToken = await getPayPalAccessToken();

          // Get the capture ID from the order details
          const orderRes = await fetch(`${config.baseUrl}/v2/checkout/orders/${pledge.paypalOrderId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!orderRes.ok) {
            throw new Error(`Failed to fetch PayPal order: ${await orderRes.text()}`);
          }

          const orderData = await orderRes.json();
          const captureId = orderData?.purchase_units?.[0]?.payments?.captures?.[0]?.id;

          if (!captureId) {
            throw new Error("Could not find PayPal capture ID for refund");
          }

          // Issue the refund via PayPal
          const refundRes = await fetch(`${config.baseUrl}/v2/payments/captures/${captureId}/refund`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "PayPal-Request-Id": `refund_${pledge.id}`,
            },
            body: JSON.stringify({
              note_to_payer: reason || "Refunded by admin",
            }),
          });

          if (!refundRes.ok) {
            const errBody = await refundRes.text();
            adminPledgesLogger.error({ pledgeId, err: errBody }, "PayPal refund API error");
            throw new Error(`PayPal refund failed: ${errBody}`);
          }

          // Update pledge status
          await db.$transaction(async (tx) => {
            await tx.pledge.update({
              where: { id: pledgeId },
              data: {
                status: "REFUNDED",
                lastFailureReason: reason || "Refunded by admin",
              },
            });

            await tx.project.update({
              where: { id: pledge.projectId },
              data: {
                backerCount: { decrement: 1 },
                currentAmount: { decrement: Number(pledge.amount) },
              },
            });
          });

          // Restore reward slot if pledge claimed one
          if (pledge.reward?.id) {
            await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.reward.id}`;
          }

          return NextResponse.json({
            success: true,
            message: "PayPal refund processed successfully",
          });
        } catch (paypalError) {
          adminPledgesLogger.error({ err: String(paypalError) }, "PayPal admin refund error:");
          return NextResponse.json(
            { error: String(paypalError) || "Failed to process PayPal refund" },
            { status: 500 }
          );
        }
      }

      // Whop refund — mark as refunded in DB; actual payment reversal must be done via Whop dashboard
      if (pledge.paymentProcessor === "WHOP") {
        try {
          await db.$transaction(async (tx) => {
            await tx.pledge.update({
              where: { id: pledgeId },
              data: {
                status: "REFUNDED",
                lastFailureReason: reason || "Refunded by admin",
              },
            });

            await tx.project.update({
              where: { id: pledge.projectId },
              data: {
                backerCount: { decrement: 1 },
                currentAmount: { decrement: Number(pledge.amount) },
              },
            });
          });

          adminPledgesLogger.info({ pledgeId, whopCheckoutId: pledge.whopCheckoutId }, "[Admin Whop Refund] Marked as refunded — process payment reversal in Whop dashboard");

          // Restore reward slot if pledge claimed one
          if (pledge.reward?.id) {
            await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.reward.id}`;
          }

          return NextResponse.json({
            success: true,
            message: "Whop pledge marked as refunded. Please also process the payment reversal in your Whop dashboard.",
          });
        } catch (whopError) {
          adminPledgesLogger.error({ err: String(whopError) }, "Whop admin refund error:");
          return NextResponse.json(
            { error: "Failed to process Whop refund" },
            { status: 500 }
          );
        }
      }

      // Stripe refund
      if (!pledge.stripePaymentIntentId) {
        return NextResponse.json(
          { error: "No payment found to refund" },
          { status: 400 }
        );
      }

      // Process refund via Stripe
      try {
        const stripeClient = await getStripeInstance();

        // Check for existing refunds to prevent duplicates
        const existingRefunds = await stripeClient.refunds.list({
          payment_intent: pledge.stripePaymentIntentId,
          limit: 1,
        });

        if (existingRefunds.data.length === 0) {
          await stripeClient.refunds.create({
            payment_intent: pledge.stripePaymentIntentId,
            reason: "requested_by_customer",
            metadata: {
              pledgeId: pledge.id,
              adminUserId: session.user.id,
              reason: reason || "Refunded by admin",
            },
          });
        } else {
          const existingRefund = existingRefunds.data[0];
          if (existingRefund.status !== "succeeded") {
            return NextResponse.json(
              { error: `Existing Stripe refund is in status '${existingRefund.status}', not succeeded. Please check the Stripe dashboard.` },
              { status: 400 }
            );
          }
          adminPledgesLogger.info(`[Admin Refund] Pledge ${pledge.id} already has existing succeeded refund(s) in Stripe`);
        }
      } catch (stripeError) {
        adminPledgesLogger.error({ err: String(stripeError) }, "Stripe refund error:");
        return NextResponse.json(
          { error: "Failed to process refund with Stripe" },
          { status: 400 }
        );
      }

      // Atomically update pledge status and project stats so they can't diverge
      await db.$transaction([
        db.pledge.update({
          where: { id: pledgeId },
          data: {
            status: "REFUNDED",
            lastFailureReason: reason || "Refunded by admin",
          },
        }),
        db.project.update({
          where: { id: pledge.projectId },
          data: {
            backerCount: { decrement: 1 },
            currentAmount: { decrement: Number(pledge.amount) },
          },
        }),
      ]);

      // Restore reward slot if pledge claimed one
      if (pledge.reward?.id) {
        await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.reward.id}`;
      }

      return NextResponse.json({
        success: true,
        message: "Pledge refunded successfully",
      });
    }

    return NextResponse.json({ error: "Invalid action. Use 'cancel', 'refund', or 'resend_receipt'" }, { status: 400 });
  } catch (error) {
    adminPledgesLogger.error({ err: String(error) }, "Admin update pledge error:");
    return NextResponse.json(
      { error: "Failed to update pledge" },
      { status: 500 }
    );
  }
}

// DELETE - Delete/cancel pledge completely (admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { pledgeId } = await params;

    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      include: {
        project: {
          select: {
            id: true,
            currentAmount: true,
          },
        },
        reward: {
          select: { id: true },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const stripeClient = await getStripeInstance();

    // Cancel any Stripe intents for PENDING pledges (safely checks status first)
    if (pledge.status === "PENDING") {
      if (pledge.stripeSetupIntentId) {
        await safeCancelSetupIntent(stripeClient, pledge.stripeSetupIntentId);
      }
      if (pledge.stripePaymentIntentId) {
        await safeCancelPaymentIntent(stripeClient, pledge.stripePaymentIntentId);
      }
    }

    // CRITICAL: Always detach the payment method to prevent any future charging
    // This is necessary because SetupIntents that already succeeded can't be "cancelled"
    // but the payment method remains valid and could be charged
    if (pledge.stripePaymentMethodId) {
      try {
        await stripeClient.paymentMethods.detach(pledge.stripePaymentMethodId);
        adminPledgesLogger.info(`[Admin Delete] Detached payment method ${pledge.stripePaymentMethodId} for pledge ${pledgeId}`);
      } catch (detachError) {
        // Log but continue - payment method might already be detached or invalid
        adminPledgesLogger.warn(`[Admin Delete] Could not detach payment method: ${detachError}`);
      }
    }

    // For COMPLETED pledges, we should refund first - warn admin (applies to all payment processors)
    if (pledge.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot delete completed pledge. Please refund first using PATCH with action='refund'" },
        { status: 400 }
      );
    }

    // Update project stats only if they were previously counted (confirmationEmailSent = true)
    if (pledge.confirmationEmailSent) {
      await db.project.update({
        where: { id: pledge.projectId },
        data: {
          backerCount: { decrement: 1 },
          currentAmount: { decrement: Number(pledge.amount) },
        },
      });
    }

    // Restore reward slot if pledge claimed one
    if (pledge.reward?.id) {
      await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.reward.id}`;
    }

    // Delete the pledge (PledgeAddon cascade-deletes automatically)
    await db.pledge.delete({
      where: { id: pledgeId },
    });

    return NextResponse.json({
      success: true,
      message: "Pledge deleted successfully",
    });
  } catch (error) {
    adminPledgesLogger.error({ err: String(error) }, "Admin delete pledge error:");
    return NextResponse.json(
      { error: "Failed to delete pledge" },
      { status: 500 }
    );
  }
}
