import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminCleanupPledgesLogger = logger.child({ module: "admin-cleanup-pledges" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";
import { isAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

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
    const where: Record<string, unknown> = { deletedAt: null };

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
        amount: Number(p.amount),
        status: p.status,
        createdAt: p.createdAt,
        paymentProcessor: p.paymentProcessor,
        stripePaymentMethodId: p.stripePaymentMethodId,
        stripePaymentIntentId: p.stripePaymentIntentId,
        stripeSetupIntentId: p.stripeSetupIntentId,
        paypalOrderId: p.paypalOrderId,
        chargedImmediately: p.chargedImmediately,
        user: p.user,
        project: p.project,
        reward: p.reward,
      })),
      duplicatesFound: duplicates.length,
      duplicates: duplicates.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        createdAt: p.createdAt,
        paymentProcessor: p.paymentProcessor,
        stripePaymentMethodId: p.stripePaymentMethodId,
        paypalOrderId: p.paypalOrderId,
        user: p.user,
        project: p.project,
      })),
    });
  } catch (error) {
    adminCleanupPledgesLogger.error({ err: String(error) }, "Admin cleanup pledges error:");
    return NextResponse.json(
      { error: "Failed to fetch pledges" },
      { status: 500 }
    );
  }
}

/**
 * POST - Safely cancel, clean up, or repair a pledge
 *
 * Body:
 * - pledgeId: The pledge to clean up (optional if action is "repair-all")
 * - projectId: Required for "repair-all" action
 * - action: "cancel" | "delete" | "repair" | "repair-all"
 *
 * For cancel/delete:
 * 1. Detach the payment method from Stripe
 * 2. Cancel any pending intents
 * 3. Update/delete the pledge
 *
 * For repair:
 * - Checks actual PaymentIntent status in Stripe and updates pledge accordingly
 * - Fixes stuck PENDING pledges that were actually charged successfully
 *
 * For repair-all:
 * - Repairs all PENDING pledges with PaymentIntentIds for a project
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
    const { pledgeId, projectId, action } = body;

    // Handle repair-all action
    if (action === "repair-all") {
      if (!projectId) {
        return NextResponse.json({ error: "projectId required for repair-all" }, { status: 400 });
      }
      return await repairAllPledges(projectId);
    }

    if (!pledgeId) {
      return NextResponse.json({ error: "pledgeId required" }, { status: 400 });
    }

    // Handle repair action for single pledge
    if (action === "repair") {
      return await repairSinglePledge(pledgeId);
    }

    if (!["cancel", "delete"].includes(action)) {
      return NextResponse.json({ error: "action must be 'cancel', 'delete', 'repair', or 'repair-all'" }, { status: 400 });
    }

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId , deletedAt: null },
      include: {
        project: { select: { id: true } },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const actions: string[] = [];

    if (pledge.paymentProcessor === "PAYPAL") {
      // PayPal orders auto-expire after ~3 hours — no explicit API cancellation needed.
      // Just log the order ID for audit purposes if present.
      if (pledge.paypalOrderId) {
        actions.push(`PayPal order ${pledge.paypalOrderId} will expire automatically (no API cancellation required)`);
      } else {
        actions.push("PayPal pledge has no order ID — checkout was never initiated");
      }
    } else {
      // Stripe-specific cleanup
      const stripe = await getStripeInstance();

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
    }

    // 4. Update or delete the pledge
    if (action === "delete") {
      // Only delete if not completed or processing (to preserve records and avoid orphaning in-flight payments)
      if (pledge.status === "COMPLETED") {
        return NextResponse.json(
          { error: "Cannot delete COMPLETED pledge - use refund instead" },
          { status: 400 }
        );
      }
      if (pledge.status === "PROCESSING") {
        return NextResponse.json(
          { error: "Cannot delete PROCESSING pledge - payment may be in-flight. Wait for webhook processing." },
          { status: 400 }
        );
      }

      // Delete the pledge inside a transaction. deleteMany returns
      // { count } so we can gate the stats decrement on count > 0 —
      // two concurrent cleanup clicks collapse to a single stats
      // decrement instead of the second admin seeing a generic 500 from
      // the P2025 that tx.pledge.delete would have thrown.
      await db.$transaction(async (tx) => {
        const deleted = await tx.pledge.deleteMany({ where: { id: pledgeId } });
        if (deleted.count === 0) {
          // Another admin already deleted this pledge — skip the stats
          // decrement so we don't double-decrement.
          return;
        }
        if (pledge.confirmationEmailSent) {
          await tx.project.update({
            where: { id: pledge.projectId },
            data: {
              backerCount: { decrement: 1 },
              currentAmount: { decrement: Number(pledge.amount) },
            },
          });
          actions.push("Decremented project stats");
        }
      });
      actions.push("Deleted pledge from database");
    } else {
      // Cancel action - CAS on status to prevent double-decrement
      // if an admin double-clicks or the request is retried. Only the
      // first call flips the status; the second finds count === 0
      // and skips the decrement.
      let wonCancelCas = false;
      await db.$transaction(async (tx) => {
        const cancelCas = await tx.pledge.updateMany({
          where: {
            id: pledgeId,
            status: { notIn: ["CANCELLED", "REFUNDED"] },
            deletedAt: null,
          },
          data: {
            status: "CANCELLED",
            stripePaymentMethodId: null,
            lastFailureReason: "Cancelled via admin cleanup",
          },
        });
        if (cancelCas.count === 0) return;
        wonCancelCas = true;

        if (pledge.confirmationEmailSent) {
          await tx.project.update({
            where: { id: pledge.projectId },
            data: {
              backerCount: { decrement: 1 },
              currentAmount: { decrement: Number(pledge.amount) },
            },
          });
          actions.push("Decremented project stats");
        }
      });

      if (wonCancelCas) {
        actions.push("Updated pledge status to CANCELLED");
      } else {
        actions.push("Pledge was already in a terminal state — no-op");
      }
    }

    return NextResponse.json({
      success: true,
      pledgeId,
      action,
      actionsPerformed: actions,
    });
  } catch (error) {
    adminCleanupPledgesLogger.error({ err: String(error) }, "Admin cleanup pledge error:");
    return NextResponse.json(
      { error: "Failed to cleanup pledge" },
      { status: 500 }
    );
  }
}

/**
 * Repair a single pledge by checking its actual Stripe status
 */
async function repairSinglePledge(pledgeId: string) {
  const stripe = await getStripeInstance();

  const pledge = await db.pledge.findFirst({
    where: { id: pledgeId , deletedAt: null },
  });

  if (!pledge) {
    return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
  }

  if (pledge.status !== "PENDING") {
    return NextResponse.json({
      success: false,
      message: `Pledge is already ${pledge.status}, no repair needed`,
      pledgeId,
    });
  }

  // Check PaymentIntent status in Stripe
  if (pledge.stripePaymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(pledge.stripePaymentIntentId);

      if (paymentIntent.status === "succeeded") {
        // Payment actually succeeded - update pledge to COMPLETED
        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            status: "COMPLETED",
            retryCount: 0,
            nextRetryAt: null,
            lastFailureReason: null,
          },
        });

        return NextResponse.json({
          success: true,
          pledgeId,
          action: "repair",
          stripeStatus: "succeeded",
          newStatus: "COMPLETED",
          message: "Pledge status updated to COMPLETED based on Stripe PaymentIntent status",
        });
      } else if (paymentIntent.status === "canceled") {
        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            status: "CANCELLED",
            lastFailureReason: "PaymentIntent was cancelled in Stripe",
          },
        });

        return NextResponse.json({
          success: true,
          pledgeId,
          action: "repair",
          stripeStatus: "canceled",
          newStatus: "CANCELLED",
          message: "Pledge status updated to CANCELLED based on Stripe PaymentIntent status",
        });
      } else if (paymentIntent.status === "requires_payment_method" && paymentIntent.last_payment_error) {
        // Payment failed
        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            status: "FAILED",
            lastFailureReason: paymentIntent.last_payment_error.message || "Payment failed",
          },
        });

        return NextResponse.json({
          success: true,
          pledgeId,
          action: "repair",
          stripeStatus: paymentIntent.status,
          newStatus: "FAILED",
          message: "Pledge status updated to FAILED based on Stripe PaymentIntent status",
        });
      } else {
        return NextResponse.json({
          success: false,
          pledgeId,
          stripeStatus: paymentIntent.status,
          message: `PaymentIntent is in status '${paymentIntent.status}', no action taken`,
        });
      }
    } catch (e) {
      return NextResponse.json({
        success: false,
        pledgeId,
        error: `Failed to retrieve PaymentIntent: ${e}`,
      });
    }
  }

  return NextResponse.json({
    success: false,
    pledgeId,
    message: "Pledge has no PaymentIntent to check",
  });
}

/**
 * Repair all PENDING pledges with PaymentIntents for a project
 */
async function repairAllPledges(projectId: string) {
  const stripe = await getStripeInstance();

  // Find all PENDING pledges with PaymentIntent IDs.
  // Prisma 7 rejects `{ field: { not: null } }` on nullable string fields at
  // runtime — use `NOT: { field: null }` wrapper syntax instead.
  const pledges = await db.pledge.findMany({
    where: {
      projectId,
      status: "PENDING",
      deletedAt: null,
      NOT: { stripePaymentIntentId: null },
    },
  });

  if (pledges.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No PENDING pledges with PaymentIntents found",
      total: 0,
      repaired: 0,
      failed: 0,
    });
  }

  const results = {
    total: pledges.length,
    repaired: 0,
    failed: 0,
    cancelled: 0,
    unchanged: 0,
    details: [] as Array<{
      pledgeId: string;
      stripeStatus: string;
      newStatus: string | null;
      error?: string;
    }>,
  };

  for (const pledge of pledges) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(pledge.stripePaymentIntentId!);

      if (paymentIntent.status === "succeeded") {
        await db.pledge.update({
          where: { id: pledge.id },
          data: {
            status: "COMPLETED",
            retryCount: 0,
            nextRetryAt: null,
            lastFailureReason: null,
          },
        });
        results.repaired++;
        results.details.push({
          pledgeId: pledge.id,
          stripeStatus: "succeeded",
          newStatus: "COMPLETED",
        });
      } else if (paymentIntent.status === "canceled") {
        await db.pledge.update({
          where: { id: pledge.id },
          data: {
            status: "CANCELLED",
            lastFailureReason: "PaymentIntent was cancelled in Stripe",
          },
        });
        results.cancelled++;
        results.details.push({
          pledgeId: pledge.id,
          stripeStatus: "canceled",
          newStatus: "CANCELLED",
        });
      } else if (paymentIntent.status === "requires_payment_method" && paymentIntent.last_payment_error) {
        await db.pledge.update({
          where: { id: pledge.id },
          data: {
            status: "FAILED",
            lastFailureReason: paymentIntent.last_payment_error.message || "Payment failed",
          },
        });
        results.failed++;
        results.details.push({
          pledgeId: pledge.id,
          stripeStatus: paymentIntent.status,
          newStatus: "FAILED",
        });
      } else {
        results.unchanged++;
        results.details.push({
          pledgeId: pledge.id,
          stripeStatus: paymentIntent.status,
          newStatus: null,
        });
      }
    } catch (e) {
      results.details.push({
        pledgeId: pledge.id,
        stripeStatus: "error",
        newStatus: null,
        error: String(e),
      });
    }
  }

  return NextResponse.json({
    success: true,
    message: `Repaired ${results.repaired} pledges, ${results.cancelled} cancelled, ${results.failed} marked failed, ${results.unchanged} unchanged`,
    ...results,
  });
}
