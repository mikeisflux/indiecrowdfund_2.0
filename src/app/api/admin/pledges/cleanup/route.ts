import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminPledgesCleanupLogger = logger.child({ module: "admin-pledges-cleanup" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST - Cleanup stale PENDING pledges (abandoned checkouts)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is admin
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { hoursOld = 24, dryRun = true } = body;

    // Calculate the cutoff time
    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

    // Find stale PENDING pledges that:
    // 1. Are in PENDING status
    // 2. Were created before the cutoff time
    // 3. Checkout never completed (no payment method/confirmation for each processor)
    const stalePledges = await db.pledge.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: cutoffTime },
        OR: [
          // Stripe pledges: no payment method saved and no confirmation sent
          {
            paymentProcessor: "STRIPE",
            stripePaymentMethodId: null,
            confirmationEmailSent: false,
            lastFailureReason: null,
          },
          // DivinityCoin pledges: no payment ID recorded
          {
            paymentProcessor: "DIVINITYCOIN",
            divinityCoinPaymentId: null,
          },
          // PayPal pledges: order was created but never captured after the cutoff window
          {
            paymentProcessor: "PAYPAL",
            paypalOrderId: { not: null },
          },
          // PayPal pledges: checkout abandoned before an order was even created
          {
            paymentProcessor: "PAYPAL",
            paypalOrderId: null,
          },
        ],
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
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
      orderBy: { createdAt: "asc" },
    });

    if (dryRun) {
      // Just return what would be cleaned up
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Found ${stalePledges.length} stale PENDING pledges older than ${hoursOld} hours`,
        count: stalePledges.length,
        pledges: stalePledges.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          createdAt: p.createdAt,
          ageHours: Math.round((Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60)),
          project: p.project.title,
          paymentProcessor: p.paymentProcessor,
          user: {
            name: p.user.name,
            email: p.user.email,
          },
          stripePaymentIntentId: p.stripePaymentIntentId,
          paypalOrderId: p.paypalOrderId,
        })),
      });
    }

    // Actually mark as ABANDONED (or CANCELLED)
    const pledgeIds = stalePledges.map((p) => p.id);

    const updated = await db.pledge.updateMany({
      where: {
        id: { in: pledgeIds },
      },
      data: {
        status: "CANCELLED",
        lastFailureReason: `Checkout abandoned - marked as cancelled after ${hoursOld} hours`,
      },
    });

    return NextResponse.json({
      success: true,
      dryRun: false,
      message: `Marked ${updated.count} stale PENDING pledges as CANCELLED`,
      count: updated.count,
      pledges: stalePledges.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        createdAt: p.createdAt,
        project: p.project.title,
        user: {
          name: p.user.name,
          email: p.user.email,
        },
      })),
    });
  } catch (error) {
    adminPledgesCleanupLogger.error({ err: String(error) }, "Error cleaning up stale pledges:");
    return NextResponse.json(
      { error: "Failed to cleanup stale pledges" },
      { status: 500 }
    );
  }
}

// GET - Preview stale pledges without making changes
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is admin
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    // Validate hoursOld parameter - default 24, min 1, max 720 (30 days)
    const hoursOld = Math.min(720, Math.max(1, parseInt(searchParams.get("hoursOld") || "24") || 24));

    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

    // Find stale PENDING pledges (all processors)
    const stalePledges = await db.pledge.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: cutoffTime },
        OR: [
          {
            paymentProcessor: "STRIPE",
            stripePaymentMethodId: null,
            confirmationEmailSent: false,
            lastFailureReason: null,
          },
          {
            paymentProcessor: "DIVINITYCOIN",
            divinityCoinPaymentId: null,
          },
          {
            paymentProcessor: "PAYPAL",
            paypalOrderId: null,
          },
        ],
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
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
      orderBy: { createdAt: "asc" },
    });

    // Also get stats on all PENDING pledges
    const allPendingCount = await db.pledge.count({
      where: { status: "PENDING" },
    });

    const staleCount = stalePledges.length;
    const totalStaleAmount = stalePledges.reduce((sum, p) => sum + Number(p.amount), 0);

    return NextResponse.json({
      success: true,
      stats: {
        totalPending: allPendingCount,
        staleCount,
        totalStaleAmount,
        hoursOldThreshold: hoursOld,
        cutoffTime: cutoffTime.toISOString(),
      },
      pledges: stalePledges.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        createdAt: p.createdAt,
        ageHours: Math.round((Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60)),
        paymentProcessor: p.paymentProcessor,
        project: {
          id: p.project.id,
          title: p.project.title,
          slug: p.project.slug,
        },
        user: {
          id: p.user.id,
          name: p.user.name,
          email: p.user.email,
        },
        stripePaymentIntentId: p.stripePaymentIntentId,
        paypalOrderId: p.paypalOrderId,
      })),
    });
  } catch (error) {
    adminPledgesCleanupLogger.error({ err: String(error) }, "Error fetching stale pledges:");
    return NextResponse.json(
      { error: "Failed to fetch stale pledges" },
      { status: 500 }
    );
  }
}
