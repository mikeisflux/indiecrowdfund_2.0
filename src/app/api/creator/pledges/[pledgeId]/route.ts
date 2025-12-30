import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance, safeCancelSetupIntent, safeCancelPaymentIntent } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

// Helper to check if user owns the project that the pledge belongs to
async function isProjectOwnerOrCollaborator(userId: string, pledgeId: string): Promise<{ allowed: boolean; pledge: unknown }> {
  const pledge = await db.pledge.findUnique({
    where: { id: pledgeId },
    include: {
      project: {
        include: {
          creator: true,
          collaborators: {
            where: {
              OR: [
                { userId, status: "ACCEPTED" },
              ],
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    // Include payment processor fields for refund handling
  });

  if (!pledge) {
    return { allowed: false, pledge: null };
  }

  // Check if user is the project creator
  if (pledge.project.creatorId === userId) {
    return { allowed: true, pledge };
  }

  // Check if user is a collaborator
  if (pledge.project.collaborators.length > 0) {
    return { allowed: true, pledge };
  }

  return { allowed: false, pledge: null };
}

// GET - Get pledge details (creator)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;
    const { allowed, pledge } = await isProjectOwnerOrCollaborator(session.user.id, pledgeId);

    if (!allowed || !pledge) {
      return NextResponse.json({ error: "Pledge not found or access denied" }, { status: 404 });
    }

    const typedPledge = pledge as {
      id: string;
      amount: number;
      status: string;
      createdAt: Date;
      paymentProcessor: "STRIPE" | "DIVINITYCOIN";
      stripePaymentIntentId: string | null;
      stripeSetupIntentId: string | null;
      divinityCoinPaymentId: string | null;
      project: { currentAmount: number; goalAmount: number; status: string };
      user: { id: string; name: string | null; email: string | null };
    };

    const isFunded = Number(typedPledge.project.currentAmount) >= Number(typedPledge.project.goalAmount) || typedPledge.project.status === "FUNDED";

    // Can refund if completed and has a payment (either Stripe or DivinityCoin)
    const canRefund = typedPledge.status === "COMPLETED" && (
      !!typedPledge.stripePaymentIntentId ||
      typedPledge.paymentProcessor === "DIVINITYCOIN"
    );

    return NextResponse.json({
      pledge: {
        id: typedPledge.id,
        amount: Number(typedPledge.amount),
        status: typedPledge.status,
        createdAt: typedPledge.createdAt,
        user: typedPledge.user,
        paymentProcessor: typedPledge.paymentProcessor,
        canCancel: typedPledge.status === "PENDING",
        canRefund,
        isFunded,
      },
    });
  } catch (error) {
    console.error("Creator get pledge error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pledge" },
      { status: 500 }
    );
  }
}

// PATCH - Cancel or refund pledge (creator)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;
    const { allowed, pledge } = await isProjectOwnerOrCollaborator(session.user.id, pledgeId);

    if (!allowed || !pledge) {
      return NextResponse.json({ error: "Pledge not found or access denied" }, { status: 404 });
    }

    const body = await req.json();
    const { action, reason } = body;

    const typedPledge = pledge as {
      id: string;
      amount: number;
      status: string;
      projectId: string;
      paymentProcessor: "STRIPE" | "DIVINITYCOIN";
      stripePaymentIntentId: string | null;
      stripeSetupIntentId: string | null;
      divinityCoinPaymentId: string | null;
      project: {
        id: string;
        title: string;
        status: string;
        currentAmount: number;
        goalAmount: number;
      };
      user: { id: string; email: string | null; name: string | null };
    };

    if (action === "cancel") {
      // Cancel a PENDING pledge (before charging)
      if (typedPledge.status !== "PENDING") {
        return NextResponse.json(
          { error: "Can only cancel pending pledges. Use refund for completed pledges." },
          { status: 400 }
        );
      }

      // Cancel any Stripe intents (safely checks status first)
      const stripe = await getStripeInstance();
      if (typedPledge.stripeSetupIntentId) {
        await safeCancelSetupIntent(stripe, typedPledge.stripeSetupIntentId);
      }
      if (typedPledge.stripePaymentIntentId) {
        await safeCancelPaymentIntent(stripe, typedPledge.stripePaymentIntentId);
      }

      // Update pledge status
      // Note: We do NOT decrement project totals here because PENDING pledges
      // haven't been counted yet - they only get added when they become COMPLETED
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "CANCELLED",
          lastFailureReason: reason || "Cancelled by creator",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Pledge cancelled successfully",
      });
    }

    if (action === "refund") {
      // Refund a COMPLETED pledge
      if (typedPledge.status !== "COMPLETED") {
        return NextResponse.json(
          { error: "Can only refund completed pledges" },
          { status: 400 }
        );
      }

      // Handle based on payment processor
      if (typedPledge.paymentProcessor === "DIVINITYCOIN") {
        // DivinityCoin refund - credit back to user's wallet
        try {
          const refundAmount = Number(typedPledge.amount);
          const userId = typedPledge.user.id;

          // Get current balance
          const user = await db.user.findUnique({
            where: { id: userId },
            select: { divinityCoinBalance: true },
          });

          const previousBalance = Number(user?.divinityCoinBalance || 0);
          const newBalance = previousBalance + refundAmount;

          // Process refund in a transaction
          await db.$transaction(async (tx) => {
            // Credit user's balance
            await tx.user.update({
              where: { id: userId },
              data: { divinityCoinBalance: newBalance },
            });

            // Create refund transaction record
            await tx.divinityCoinTransaction.create({
              data: {
                userId,
                pledgeId: typedPledge.id,
                amount: refundAmount, // Positive because it's a credit back
                type: "REFUND",
                description: `Refund for pledge on "${typedPledge.project.title}"`,
                metadata: JSON.stringify({
                  creatorUserId: session.user.id,
                  reason: reason || "Refunded by creator",
                  previousBalance,
                  newBalance,
                  projectId: typedPledge.projectId,
                  divinityCoinPaymentId: typedPledge.divinityCoinPaymentId,
                  processedAt: new Date().toISOString(),
                }),
              },
            });

            // Update pledge status
            await tx.pledge.update({
              where: { id: pledgeId },
              data: {
                status: "REFUNDED",
                lastFailureReason: reason || "Refunded by creator",
              },
            });

            // Update project backer count and amount
            await tx.project.update({
              where: { id: typedPledge.projectId },
              data: {
                backerCount: { decrement: 1 },
                currentAmount: { decrement: typedPledge.amount },
              },
            });
          });

          console.log(`[DivinityCoin Refund] Processed refund for pledge ${pledgeId}. User ${userId}: ${previousBalance} -> ${newBalance}`);

          return NextResponse.json({
            success: true,
            message: "DivinityCoin refunded to backer's wallet successfully",
            refundedTo: "wallet",
            amount: refundAmount,
          });
        } catch (divinityError) {
          console.error("DivinityCoin refund error:", divinityError);
          return NextResponse.json(
            { error: "Failed to process DivinityCoin refund" },
            { status: 500 }
          );
        }
      } else {
        // Stripe refund
        if (!typedPledge.stripePaymentIntentId) {
          return NextResponse.json(
            { error: "No Stripe payment found to refund" },
            { status: 400 }
          );
        }

        // Process refund via Stripe
        try {
          const stripeClient = await getStripeInstance();
          await stripeClient.refunds.create({
            payment_intent: typedPledge.stripePaymentIntentId,
            reason: "requested_by_customer",
            metadata: {
              pledgeId: typedPledge.id,
              creatorUserId: session.user.id,
              reason: reason || "Refunded by creator",
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
            lastFailureReason: reason || "Refunded by creator",
          },
        });

        // Update project backer count and amount
        await db.project.update({
          where: { id: typedPledge.projectId },
          data: {
            backerCount: { decrement: 1 },
            currentAmount: { decrement: typedPledge.amount },
          },
        });

        return NextResponse.json({
          success: true,
          message: "Stripe refund processed successfully",
          refundedTo: "card",
        });
      }
    }

    return NextResponse.json({ error: "Invalid action. Use 'cancel' or 'refund'" }, { status: 400 });
  } catch (error) {
    console.error("Creator update pledge error:", error);
    return NextResponse.json(
      { error: "Failed to update pledge" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a CANCELLED or PENDING pledge (creator)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  // Consume request to satisfy Next.js dynamic route requirements
  void request;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;
    const { allowed, pledge } = await isProjectOwnerOrCollaborator(session.user.id, pledgeId);

    if (!allowed || !pledge) {
      return NextResponse.json({ error: "Pledge not found or access denied" }, { status: 404 });
    }

    const typedPledge = pledge as {
      id: string;
      status: string;
    };

    // Only allow deleting CANCELLED or PENDING pledges
    if (typedPledge.status !== "CANCELLED" && typedPledge.status !== "PENDING") {
      return NextResponse.json(
        { error: "Can only delete cancelled or pending pledges" },
        { status: 400 }
      );
    }

    // Delete in a transaction to handle related records that don't have cascade delete
    await db.$transaction(async (tx) => {
      // Delete related DivinityCoinTransactions (no cascade in schema)
      await tx.divinityCoinTransaction.deleteMany({
        where: { pledgeId },
      });

      // Delete related EmailLogs (no cascade in schema)
      await tx.emailLog.deleteMany({
        where: { pledgeId },
      });

      // Delete related SurveyResponses (no cascade in schema)
      await tx.surveyResponse.deleteMany({
        where: { pledgeId },
      });

      // Delete related DigitalDistributions (no cascade in schema)
      await tx.digitalDistribution.deleteMany({
        where: { pledgeId },
      });

      // Delete related BackerNotes (no cascade in schema)
      await tx.backerNote.deleteMany({
        where: { pledgeId },
      });

      // Unlink EmailCampaignClicks (no cascade in schema)
      await tx.emailCampaignClick.updateMany({
        where: { pledgeId },
        data: { pledgeId: null },
      });

      // Delete related FulfillmentActivities (no cascade in schema)
      await tx.fulfillmentActivity.deleteMany({
        where: { pledgeId },
      });

      // Delete PledgeAddons explicitly (has cascade but being safe)
      await tx.pledgeAddon.deleteMany({
        where: { pledgeId },
      });

      // Now delete the pledge
      await tx.pledge.delete({
        where: { id: pledgeId },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Pledge deleted successfully",
    });
  } catch (error) {
    console.error("Creator delete pledge error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete pledge", details: errorMessage },
      { status: 500 }
    );
  }
}
