import { NextRequest, NextResponse } from "next/server";
import { processPaymentRetries } from "@/lib/payments/stripe";

/**
 * Cron job endpoint for processing payment retries
 *
 * This should be called by a cron service (Vercel Cron, Railway, etc.)
 * Schedule: Every hour or daily
 *
 * Example Vercel cron config (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/payment-retries",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 *
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Allow if no secret is configured (dev mode) or if secret matches
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Process retries
    const results = await processPaymentRetries();

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Payment retry cron error:", error);
    return NextResponse.json(
      { error: "Failed to process payment retries" },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(req: NextRequest) {
  return GET(req);
}
