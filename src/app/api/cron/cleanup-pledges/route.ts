import { NextRequest, NextResponse } from "next/server";
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

  // Allow localhost requests (for internal cron)
  const host = req.headers.get("host") || "";
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    return true;
  }

  return false;
}

// POST - Run the stale pledge cleanup
export async function POST(req: NextRequest) {
  try {
    // Verify authorization
    if (!verifyCronAuth(req)) {
      console.log("[Cron] Unauthorized cleanup attempt");
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

    console.log(`[Cron] Running stale pledge cleanup (hoursOld: ${hoursOld}, dryRun: ${dryRun})`);

    // Calculate the cutoff time
    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

    // Find stale PENDING pledges
    const stalePledges = await db.pledge.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: cutoffTime },
        stripePaymentMethodId: null,
        confirmationEmailSent: false,
        lastFailureReason: null,
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        project: {
          select: { title: true },
        },
        user: {
          select: { email: true },
        },
      },
    });

    if (dryRun) {
      console.log(`[Cron] Dry run: Would cleanup ${stalePledges.length} stale pledges`);
      return NextResponse.json({
        success: true,
        dryRun: true,
        count: stalePledges.length,
        message: `Would mark ${stalePledges.length} stale pledges as CANCELLED`,
      });
    }

    if (stalePledges.length === 0) {
      console.log("[Cron] No stale pledges found to cleanup");
      return NextResponse.json({
        success: true,
        count: 0,
        message: "No stale pledges to cleanup",
      });
    }

    // Mark as CANCELLED
    const pledgeIds = stalePledges.map((p) => p.id);

    const updated = await db.pledge.updateMany({
      where: {
        id: { in: pledgeIds },
      },
      data: {
        status: "CANCELLED",
        lastFailureReason: `Checkout abandoned - auto-cancelled after ${hoursOld} hours by cron job`,
      },
    });

    console.log(`[Cron] Cleaned up ${updated.count} stale pledges`);

    // Log details for auditing
    stalePledges.forEach((p) => {
      console.log(`[Cron] Cancelled pledge ${p.id} ($${p.amount}) for "${p.project.title}" - user: ${p.user.email}`);
    });

    return NextResponse.json({
      success: true,
      count: updated.count,
      message: `Marked ${updated.count} stale pledges as CANCELLED`,
      totalAmountCleared: stalePledges.reduce((sum, p) => sum + p.amount, 0),
    });
  } catch (error) {
    console.error("[Cron] Error in pledge cleanup:", error);
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

  // Get current count of stale pledges
  const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const staleCount = await db.pledge.count({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoffTime },
      stripePaymentMethodId: null,
      confirmationEmailSent: false,
      lastFailureReason: null,
    },
  });

  return NextResponse.json({
    status: "ok",
    stalePledgesCount: staleCount,
    nextCleanupThreshold: "48 hours",
  });
}
