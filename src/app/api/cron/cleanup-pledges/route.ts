import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const cronCleanupPledgesLogger = logger.child({ module: "cron-cleanup-pledges" });
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Verify cron authorization
function verifyCronAuth(req: NextRequest): boolean {
  // Check for Vercel Cron secret (if using Vercel)
  const vercelCronSecret = process.env.CRON_SECRET;
  if (vercelCronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${vercelCronSecret}`) {
      return true;
    }
  }

  // Check for admin API key (for self-hosted cron)
  const adminApiKey = process.env.ADMIN_API_KEY;
  if (adminApiKey) {
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${adminApiKey}`) {
      return true;
    }
  }

  return false;
}

// POST - Run the stale pledge cleanup
export async function POST(req: NextRequest) {
  try {
    // Verify authorization
    if (!verifyCronAuth(req)) {
      cronCleanupPledgesLogger.info("[Cron] Unauthorized cleanup attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let hoursOld = 48; // Default to 48 hours
    let dryRun = false;

    try {
      const body = await req.json();
      if (body.hoursOld) hoursOld = parseInt(body.hoursOld);
      if (body.dryRun !== undefined) dryRun = body.dryRun;
    } catch {
      // No body or invalid JSON, use defaults
    }

    cronCleanupPledgesLogger.info(`[Cron] Running stale pledge cleanup (hoursOld: ${hoursOld}, dryRun: ${dryRun})`);

    // Calculate the cutoff time
    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

    // Find stale PENDING pledges - includes Stripe, DivinityCoin, and PayPal
    // A pledge is stale if:
    // 1. Status is PENDING
    // 2. Created more than N hours ago
    // 3. For Stripe: No payment method saved AND no confirmation sent AND no failure reason
    // 4. For DivinityCoin: No payment ID (never completed payment)
    // 5. For PayPal: No order ID captured (never completed payment; PayPal orders auto-expire ~3h)
    const stalePledges = await db.pledge.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: cutoffTime },
        OR: [
          // Stripe pledges: no payment method, no confirmation, no failure
          {
            paymentProcessor: "STRIPE",
            stripePaymentMethodId: null,
            confirmationEmailSent: false,
            lastFailureReason: null,
          },
          // DivinityCoin pledges: never paid (no payment ID)
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
      select: {
        id: true,
        amount: true,
        createdAt: true,
        paymentProcessor: true,
        paypalOrderId: true,
        project: {
          select: { title: true },
        },
        user: {
          select: { email: true },
        },
      },
    });

    if (dryRun) {
      cronCleanupPledgesLogger.info(`[Cron] Dry run: Would cleanup ${stalePledges.length} stale pledges`);
      return NextResponse.json({
        success: true,
        dryRun: true,
        count: stalePledges.length,
        message: `Would mark ${stalePledges.length} stale pledges as CANCELLED`,
      });
    }

    if (stalePledges.length === 0) {
      cronCleanupPledgesLogger.info("[Cron] No stale pledges found to cleanup");
      return NextResponse.json({
        success: true,
        count: 0,
        message: "No stale pledges to cleanup",
      });
    }

    // Delete stale pledges (not just mark as cancelled)
    const pledgeIds = stalePledges.map((p) => p.id);

    // Log details for auditing before deletion
    stalePledges.forEach((p) => {
      cronCleanupPledgesLogger.info(`[Cron] Deleting stale pledge ${p.id} ($${p.amount}) for "${p.project.title}" - user: ${p.user.email}`);
    });

    // Delete associated addons first (foreign key constraint)
    await db.pledgeAddon.deleteMany({
      where: { pledgeId: { in: pledgeIds } },
    });

    // Delete the pledges
    const deleted = await db.pledge.deleteMany({
      where: { id: { in: pledgeIds } },
    });

    cronCleanupPledgesLogger.info(`[Cron] Deleted ${deleted.count} stale pledges`);

    return NextResponse.json({
      success: true,
      count: deleted.count,
      message: `Deleted ${deleted.count} stale pledges`,
      totalAmountCleared: stalePledges.reduce((sum, p) => sum + Number(p.amount), 0),
    });
  } catch (error) {
    cronCleanupPledgesLogger.error({ err: String(error) }, "[Cron] Error in pledge cleanup:");
    return NextResponse.json(
      { error: "Failed to cleanup stale pledges" },
      { status: 500 }
    );
  }
}

// GET - Health check / status
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get current count of stale pledges (Stripe, DivinityCoin, and PayPal)
  const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const staleCount = await db.pledge.count({
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
          paypalOrderId: { not: null },
        },
        {
          paymentProcessor: "PAYPAL",
          paypalOrderId: null,
        },
      ],
    },
  });

  return NextResponse.json({
    status: "ok",
    stalePledgesCount: staleCount,
    nextCleanupThreshold: "48 hours",
  });
}
