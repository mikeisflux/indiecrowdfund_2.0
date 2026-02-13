import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance, safeCancelSetupIntent, safeCancelPaymentIntent } from "@/lib/payments/stripe";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";
import { sendPledgeConfirmationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Helper to check admin status
async function isAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

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
          pledge.paymentProcessor === "DIVINITYCOIN"
        ),
        isFunded,
      },
    });
  } catch (error) {
    console.error("Admin get pledge error:", error);
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
          pledge.project.currency || "USD"
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
        console.error("Error sending receipt email:", emailError);
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
          console.log(`[Admin Cancel] Detached payment method ${pledge.stripePaymentMethodId} for pledge ${pledgeId}`);
        } catch (detachError) {
          // Log but continue - payment method might already be detached or invalid
          console.warn(`[Admin Cancel] Could not detach payment method: ${detachError}`);
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

      // Update project backer count and amount
      await db.project.update({
        where: { id: pledge.projectId },
        data: {
          backerCount: { decrement: 1 },
          currentAmount: { decrement: pledge.amount },
        },
      });

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
            console.error(`[Admin DivinityCoin Refund] DC API refund failed for pledge ${pledgeId}:`, dcResult.error);
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
                currentAmount: { decrement: pledge.amount },
              },
            });
          });

          return NextResponse.json({
            success: true,
            message: "DivinityCoin refund processed successfully",
          });
        } catch (dcError) {
          console.error("DivinityCoin admin refund error:", dcError);
          return NextResponse.json(
            { error: "Failed to process DivinityCoin refund" },
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
        await stripeClient.refunds.create({
          payment_intent: pledge.stripePaymentIntentId,
          reason: "requested_by_customer",
          metadata: {
            pledgeId: pledge.id,
            adminUserId: session.user.id,
            reason: reason || "Refunded by admin",
          },
        });
      } catch (stripeError) {
        console.error("Stripe refund error:", stripeError);
        return NextResponse.json(
          { error: "Failed to process refund with Stripe" },
          { status: 400 }
        );
      }

      // Update pledge status
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "REFUNDED",
          lastFailureReason: reason || "Refunded by admin",
        },
      });

      // Update project backer count and amount
      await db.project.update({
        where: { id: pledge.projectId },
        data: {
          backerCount: { decrement: 1 },
          currentAmount: { decrement: pledge.amount },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Pledge refunded successfully",
      });
    }

    return NextResponse.json({ error: "Invalid action. Use 'cancel', 'refund', or 'resend_receipt'" }, { status: 400 });
  } catch (error) {
    console.error("Admin update pledge error:", error);
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
        console.log(`[Admin Delete] Detached payment method ${pledge.stripePaymentMethodId} for pledge ${pledgeId}`);
      } catch (detachError) {
        // Log but continue - payment method might already be detached or invalid
        console.warn(`[Admin Delete] Could not detach payment method: ${detachError}`);
      }
    }

    // For COMPLETED pledges, we should refund first - warn admin
    if (pledge.status === "COMPLETED" && pledge.stripePaymentIntentId) {
      return NextResponse.json(
        { error: "Cannot delete completed pledge. Please refund first using PATCH with action='refund'" },
        { status: 400 }
      );
    }

    // Update project stats if pledge was active (PENDING or COMPLETED)
    if (pledge.status === "PENDING" || pledge.status === "COMPLETED") {
      await db.project.update({
        where: { id: pledge.projectId },
        data: {
          backerCount: { decrement: 1 },
          currentAmount: { decrement: pledge.amount },
        },
      });
    }

    // Delete the pledge
    await db.pledge.delete({
      where: { id: pledgeId },
    });

    return NextResponse.json({
      success: true,
      message: "Pledge deleted successfully",
    });
  } catch (error) {
    console.error("Admin delete pledge error:", error);
    return NextResponse.json(
      { error: "Failed to delete pledge" },
      { status: 500 }
    );
  }
}
