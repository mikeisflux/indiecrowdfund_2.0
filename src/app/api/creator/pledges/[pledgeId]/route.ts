import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

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
      stripePaymentIntentId: string | null;
      stripeSetupIntentId: string | null;
      project: { currentAmount: number; goalAmount: number; status: string };
      user: { id: string; name: string | null; email: string | null };
    };

    const isFunded = typedPledge.project.currentAmount >= typedPledge.project.goalAmount || typedPledge.project.status === "FUNDED";

    return NextResponse.json({
      pledge: {
        id: typedPledge.id,
        amount: typedPledge.amount,
        status: typedPledge.status,
        createdAt: typedPledge.createdAt,
        user: typedPledge.user,
        canCancel: typedPledge.status === "PENDING",
        canRefund: typedPledge.status === "COMPLETED" && !!typedPledge.stripePaymentIntentId,
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
      stripePaymentIntentId: string | null;
      stripeSetupIntentId: string | null;
      project: {
        id: string;
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

      // Cancel any Stripe intents
      if (typedPledge.stripeSetupIntentId) {
        try {
          await stripe.setupIntents.cancel(typedPledge.stripeSetupIntentId);
        } catch (e) {
          console.log("Could not cancel setup intent:", e);
        }
      }
      if (typedPledge.stripePaymentIntentId) {
        try {
          await stripe.paymentIntents.cancel(typedPledge.stripePaymentIntentId);
        } catch (e) {
          console.log("Could not cancel payment intent:", e);
        }
      }

      // Update pledge status
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "CANCELLED",
          lastFailureReason: reason || "Cancelled by creator",
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

      if (!typedPledge.stripePaymentIntentId) {
        return NextResponse.json(
          { error: "No payment found to refund" },
          { status: 400 }
        );
      }

      // Process refund via Stripe
      try {
        await stripe.refunds.create({
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
        message: "Pledge refunded successfully",
      });
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
