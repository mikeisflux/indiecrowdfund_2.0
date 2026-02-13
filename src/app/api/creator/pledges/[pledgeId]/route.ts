import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance, safeCancelSetupIntent, safeCancelPaymentIntent } from "@/lib/payments/stripe";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";
import { sendEmail } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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
      paymentProcessor: "STRIPE" | "DIVINITYCOIN" | "CHAIN2PAY";
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
      paymentProcessor: "STRIPE" | "DIVINITYCOIN" | "CHAIN2PAY";
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
        // DivinityCoin refund - call DC API to process Stripe refund on their end
        try {
          const refundAmount = Number(typedPledge.amount);

          // Call DC's refund API - this processes the Stripe refund on DC's account
          const dcResult = await callDivinityCoinAPI("refund", {
            pledgeId: typedPledge.id,
            paymentId: typedPledge.divinityCoinPaymentId,
            amount: Math.round(refundAmount * 100), // cents
            reason: reason || "Refunded by creator",
            requestedBy: "creator",
          });

          if (!dcResult.success) {
            console.error(`[DivinityCoin Refund] DC API refund failed for pledge ${pledgeId}:`, dcResult.error);
            return NextResponse.json(
              { error: dcResult.error || "DivinityCoin refund failed" },
              { status: 400 }
            );
          }

          // Update pledge and project in a transaction
          await db.$transaction(async (tx) => {
            // Create refund transaction record
            await tx.divinityCoinTransaction.create({
              data: {
                userId: typedPledge.user.id,
                pledgeId: typedPledge.id,
                amount: -refundAmount,
                type: "REFUND",
                description: `Refund for pledge on "${typedPledge.project.title}"`,
                metadata: JSON.stringify({
                  creatorUserId: session.user.id,
                  reason: reason || "Refunded by creator",
                  projectId: typedPledge.projectId,
                  divinityCoinPaymentId: typedPledge.divinityCoinPaymentId,
                  dcRefundResult: dcResult.data,
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

          console.log(`[DivinityCoin Refund] Processed refund for pledge ${pledgeId} via DC API`);

          // Send refund notification email to backer
          if (typedPledge.user.email) {
            try {
              await sendEmail({
                to: typedPledge.user.email,
                subject: `Your refund for "${typedPledge.project.title}" has been processed`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #16a34a;">Refund Processed</h2>
                    <p>Hi ${typedPledge.user.name || "there"},</p>
                    <p>Your refund for <strong>${typedPledge.project.title}</strong> has been successfully processed.</p>
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                      <p style="margin: 0 0 8px 0;"><strong>Refund Amount:</strong> $${refundAmount.toFixed(2)}</p>
                      <p style="margin: 0;"><strong>Refunded To:</strong> Original payment method (credit/debit card)</p>
                    </div>
                    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
                    <p>Please allow 5-10 business days for the refund to appear on your statement.</p>
                    <p style="margin-top: 20px;">
                      <a href="${APP_URL}/dashboard/backer" style="background: #0066FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">View Your Dashboard</a>
                    </p>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                      If you have any questions, please contact the project creator or our support team.
                    </p>
                  </div>
                `,
                skipUnsubscribeCheck: true, // Transactional email
              });
            } catch (emailError) {
              console.error("Failed to send refund email:", emailError);
              // Don't fail the refund if email fails
            }
          }

          return NextResponse.json({
            success: true,
            message: "Refund processed successfully via DivinityCoin",
            refundedTo: "card",
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

        // Send refund notification email to backer
        if (typedPledge.user.email) {
          try {
            const refundAmount = Number(typedPledge.amount);
            await sendEmail({
              to: typedPledge.user.email,
              subject: `Your refund for "${typedPledge.project.title}" has been processed`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #16a34a;">Refund Processed</h2>
                  <p>Hi ${typedPledge.user.name || "there"},</p>
                  <p>Your refund for <strong>${typedPledge.project.title}</strong> has been successfully processed.</p>
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 8px 0;"><strong>Refund Amount:</strong> $${refundAmount.toFixed(2)}</p>
                    <p style="margin: 0;"><strong>Refunded To:</strong> Original payment method</p>
                  </div>
                  ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
                  <p>Please allow 5-10 business days for the refund to appear on your statement, depending on your bank.</p>
                  <p style="margin-top: 20px;">
                    <a href="${APP_URL}/dashboard/backer" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">View Your Dashboard</a>
                  </p>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    If you have any questions, please contact the project creator or our support team.
                  </p>
                </div>
              `,
              skipUnsubscribeCheck: true, // Transactional email
            });
          } catch (emailError) {
            console.error("Failed to send refund email:", emailError);
            // Don't fail the refund if email fails
          }
        }

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

    console.log(`[DELETE] Starting deletion of pledge ${pledgeId}, current status: ${typedPledge.status}`);

    // Delete in a transaction to handle related records that don't have cascade delete
    await db.$transaction(async (tx) => {
      console.log(`[DELETE] Step 1: Deleting DivinityCoinTransactions`);
      await tx.divinityCoinTransaction.deleteMany({
        where: { pledgeId },
      });

      console.log(`[DELETE] Step 2: Deleting EmailLogs`);
      await tx.emailLog.deleteMany({
        where: { pledgeId },
      });

      console.log(`[DELETE] Step 3: Deleting SurveyResponses`);
      await tx.surveyResponse.deleteMany({
        where: { pledgeId },
      });

      console.log(`[DELETE] Step 4: Deleting DigitalDistributions`);
      await tx.digitalDistribution.deleteMany({
        where: { pledgeId },
      });

      console.log(`[DELETE] Step 5: Deleting BackerNotes`);
      await tx.backerNote.deleteMany({
        where: { pledgeId },
      });

      console.log(`[DELETE] Step 6: Unlinking EmailCampaignClicks`);
      await tx.emailCampaignClick.updateMany({
        where: { pledgeId },
        data: { pledgeId: null },
      });

      console.log(`[DELETE] Step 7: Deleting FulfillmentActivities`);
      await tx.fulfillmentActivity.deleteMany({
        where: { pledgeId },
      });

      console.log(`[DELETE] Step 8: Deleting PledgeAddons`);
      await tx.pledgeAddon.deleteMany({
        where: { pledgeId },
      });

      console.log(`[DELETE] Step 9: Deleting the Pledge itself`);
      await tx.pledge.delete({
        where: { id: pledgeId },
      });

      console.log(`[DELETE] Step 10: Transaction complete`);
    });

    console.log(`[DELETE] Successfully deleted pledge ${pledgeId}`);

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
