import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

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

    const isFunded = pledge.project.currentAmount >= pledge.project.goalAmount || pledge.project.status === "FUNDED";

    return NextResponse.json({
      pledge: {
        id: pledge.id,
        amount: pledge.amount,
        status: pledge.status,
        createdAt: pledge.createdAt,
        stripePaymentIntentId: pledge.stripePaymentIntentId,
        stripeSetupIntentId: pledge.stripeSetupIntentId,
        user: pledge.user,
        project: pledge.project,
        reward: pledge.reward,
        addons: pledge.addons.map((a: { addon: { id: string; title: string; amount: number }; quantity: number }) => ({
          id: a.addon.id,
          title: a.addon.title,
          amount: a.addon.amount,
          quantity: a.quantity,
        })),
        canCancel: pledge.status === "PENDING",
        canRefund: pledge.status === "COMPLETED" && !!pledge.stripePaymentIntentId,
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
            status: true,
            currentAmount: true,
            goalAmount: true,
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

    if (action === "cancel") {
      // Cancel a PENDING pledge (before charging)
      if (pledge.status !== "PENDING") {
        return NextResponse.json(
          { error: "Can only cancel pending pledges. Use refund for completed pledges." },
          { status: 400 }
        );
      }

      // Cancel any Stripe intents
      if (pledge.stripeSetupIntentId) {
        try {
          await stripe.setupIntents.cancel(pledge.stripeSetupIntentId);
        } catch (e) {
          console.log("Could not cancel setup intent:", e);
        }
      }
      if (pledge.stripePaymentIntentId) {
        try {
          await stripe.paymentIntents.cancel(pledge.stripePaymentIntentId);
        } catch (e) {
          console.log("Could not cancel payment intent:", e);
        }
      }

      // Update pledge status
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: reason || "Cancelled by admin",
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

      if (!pledge.stripePaymentIntentId) {
        return NextResponse.json(
          { error: "No payment found to refund" },
          { status: 400 }
        );
      }

      // Process refund via Stripe
      try {
        await stripe.refunds.create({
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
          refundedAt: new Date(),
          cancelReason: reason || "Refunded by admin",
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

    return NextResponse.json({ error: "Invalid action. Use 'cancel' or 'refund'" }, { status: 400 });
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

    // Cancel any Stripe intents for PENDING pledges
    if (pledge.status === "PENDING") {
      if (pledge.stripeSetupIntentId) {
        try {
          await stripe.setupIntents.cancel(pledge.stripeSetupIntentId);
        } catch (e) {
          console.log("Could not cancel setup intent:", e);
        }
      }
      if (pledge.stripePaymentIntentId) {
        try {
          await stripe.paymentIntents.cancel(pledge.stripePaymentIntentId);
        } catch (e) {
          console.log("Could not cancel payment intent:", e);
        }
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
