import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminCleanupPledgesLogger = logger.child({ module: "admin-cleanup-pledges" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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
 * POST - Safely cancel or clean up a pledge
 *
 * Body:
 * - pledgeId: The pledge to clean up
 * - action: "cancel" | "delete"
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
      actions.push(`No external cleanup performed for ${pledge.paymentProcessor || "unknown"} pledge`);
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

