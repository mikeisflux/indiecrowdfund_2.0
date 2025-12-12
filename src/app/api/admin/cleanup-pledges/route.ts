import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

// Helper to check admin status
async function isAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

/**
 * GET - Find duplicate/problematic pledges that might cause double-charging
 *
 * Query params:
 * - userId: Find all pledges for a specific user
 * - projectId: Find all pledges for a specific project
 * - email: Find all pledges by user email
 * - status: Filter by status (PENDING, COMPLETED, etc)
 * - showAll: Show ALL pledges including cancelled/failed (default: only PENDING)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const projectId = searchParams.get("projectId");
    const email = searchParams.get("email");
    const status = searchParams.get("status");
    const showAll = searchParams.get("showAll") === "true";

    // Build where clause
    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (email) {
      where.user = { email };
    }

    if (status) {
      where.status = status;
    } else if (!showAll) {
      // Default: only show pledges that could be charged
      where.status = { in: ["PENDING"] };
    }

    const pledges = await db.pledge.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
          },
        },
        reward: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Find potential duplicates (same user + project + similar amount within 5 minutes)
    const duplicates: typeof pledges = [];
    const seen = new Map<string, typeof pledges[0]>();

    for (const pledge of pledges) {
      const key = `${pledge.userId}-${pledge.projectId}-${pledge.amount}`;
      const existing = seen.get(key);

      if (existing) {
        const timeDiff = Math.abs(
          new Date(pledge.createdAt).getTime() - new Date(existing.createdAt).getTime()
        );
        // If within 10 minutes, likely a duplicate
        if (timeDiff < 10 * 60 * 1000) {
          duplicates.push(pledge);
          if (!duplicates.includes(existing)) {
            duplicates.push(existing);
          }
        }
      }
      seen.set(key, pledge);
    }

    return NextResponse.json({
      total: pledges.length,
      pledges: pledges.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt,
        stripePaymentMethodId: p.stripePaymentMethodId,
        stripePaymentIntentId: p.stripePaymentIntentId,
        stripeSetupIntentId: p.stripeSetupIntentId,
        chargedImmediately: p.chargedImmediately,
        user: p.user,
        project: p.project,
        reward: p.reward,
      })),
      duplicatesFound: duplicates.length,
      duplicates: duplicates.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt,
        stripePaymentMethodId: p.stripePaymentMethodId,
        user: p.user,
        project: p.project,
      })),
    });
  } catch (error) {
    console.error("Admin cleanup pledges error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pledges" },
      { status: 500 }
    );
  }
}

/**
 * POST - Safely cancel and clean up a pledge
 *
 * Body:
 * - pledgeId: The pledge to clean up
 * - action: "cancel" | "delete"
 *
 * This will:
 * 1. Detach the payment method from Stripe
 * 2. Cancel any pending intents
 * 3. Update/delete the pledge
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { pledgeId, action } = body;

    if (!pledgeId) {
      return NextResponse.json({ error: "pledgeId required" }, { status: 400 });
    }

    if (!["cancel", "delete"].includes(action)) {
      return NextResponse.json({ error: "action must be 'cancel' or 'delete'" }, { status: 400 });
    }

    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      include: {
        project: { select: { id: true } },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const stripe = await getStripeInstance();
    const actions: string[] = [];

    // 1. Detach payment method if exists
    if (pledge.stripePaymentMethodId) {
      try {
        await stripe.paymentMethods.detach(pledge.stripePaymentMethodId);
        actions.push(`Detached payment method ${pledge.stripePaymentMethodId}`);
      } catch (e) {
        actions.push(`Could not detach payment method: ${e}`);
      }
    }

    // 2. Cancel SetupIntent if exists
    if (pledge.stripeSetupIntentId) {
      try {
        const si = await stripe.setupIntents.retrieve(pledge.stripeSetupIntentId);
        if (["requires_payment_method", "requires_confirmation", "requires_action"].includes(si.status)) {
          await stripe.setupIntents.cancel(pledge.stripeSetupIntentId);
          actions.push(`Cancelled SetupIntent ${pledge.stripeSetupIntentId}`);
        } else {
          actions.push(`SetupIntent ${pledge.stripeSetupIntentId} already in terminal state: ${si.status}`);
        }
      } catch (e) {
        actions.push(`Could not cancel SetupIntent: ${e}`);
      }
    }

    // 3. Cancel PaymentIntent if exists and not yet charged
    if (pledge.stripePaymentIntentId && pledge.status === "PENDING") {
      try {
        const pi = await stripe.paymentIntents.retrieve(pledge.stripePaymentIntentId);
        if (["requires_payment_method", "requires_confirmation", "requires_action", "requires_capture", "processing"].includes(pi.status)) {
          await stripe.paymentIntents.cancel(pledge.stripePaymentIntentId);
          actions.push(`Cancelled PaymentIntent ${pledge.stripePaymentIntentId}`);
        } else {
          actions.push(`PaymentIntent ${pledge.stripePaymentIntentId} already in terminal state: ${pi.status}`);
        }
      } catch (e) {
        actions.push(`Could not cancel PaymentIntent: ${e}`);
      }
    }

    // 4. Update or delete the pledge
    if (action === "delete") {
      // Only delete if not completed (to preserve records)
      if (pledge.status === "COMPLETED") {
        return NextResponse.json(
          { error: "Cannot delete COMPLETED pledge - use refund instead" },
          { status: 400 }
        );
      }

      // Update project stats if pledge was PENDING
      if (pledge.status === "PENDING") {
        await db.project.update({
          where: { id: pledge.projectId },
          data: {
            backerCount: { decrement: 1 },
            currentAmount: { decrement: pledge.amount },
          },
        });
        actions.push("Decremented project stats");
      }

      await db.pledge.delete({ where: { id: pledgeId } });
      actions.push("Deleted pledge from database");
    } else {
      // Cancel action - update status
      if (pledge.status === "PENDING") {
        await db.project.update({
          where: { id: pledge.projectId },
          data: {
            backerCount: { decrement: 1 },
            currentAmount: { decrement: pledge.amount },
          },
        });
        actions.push("Decremented project stats");
      }

      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "CANCELLED",
          stripePaymentMethodId: null,
          lastFailureReason: "Cancelled via admin cleanup",
        },
      });
      actions.push("Updated pledge status to CANCELLED");
    }

    return NextResponse.json({
      success: true,
      pledgeId,
      action,
      actionsPerformed: actions,
    });
  } catch (error) {
    console.error("Admin cleanup pledge error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup pledge" },
      { status: 500 }
    );
  }
}
