import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const cronEmailRetriesLogger = logger.child({ module: "cron-email-retries" });
import { processUnsentConfirmationEmails } from "@/lib/notifications";

// Cron job endpoint for processing unsent pledge confirmation emails
//
// This should be called by a cron service (Vercel Cron, Railway, etc.)
// Schedule: Every 15 minutes or hourly
//
// Example Vercel cron config (vercel.json):
// { "crons": [{ "path": "/api/cron/email-retries", "schedule": "0/15 * * * *" }] }
//
// Security: Protected by CRON_SECRET environment variable

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Process unsent confirmation emails
    const results = await processUnsentConfirmationEmails();

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    cronEmailRetriesLogger.error({ err: String(error) }, "Email retry cron error:");
    return NextResponse.json(
      { error: "Failed to process email retries" },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(req: NextRequest) {
  return GET(req);
}
