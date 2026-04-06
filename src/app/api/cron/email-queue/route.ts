import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const cronEmailQueueLogger = logger.child({ module: "cron-email-queue" });
import { processEmailQueue, getEmailQueueStats, isEmailQueueEnabled, recoverStuckProcessingEmails } from "@/lib/email";

// Cron job endpoint for processing the email queue
//
// Rate limited to max 1 email per second (60 emails/minute)
// Sequential processing to respect email provider rate limits
//
// Schedule: Every minute
//
// Example PM2 cron config:
// Use crontab: * * * * * curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/email-queue
//
// Example Vercel cron config (vercel.json):
// { "crons": [{ "path": "/api/cron/email-queue", "schedule": "* * * * *" }] }
//
// Security: Protected by CRON_SECRET environment variable

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for processing

// Configuration for rate limiting
const EMAIL_DELAY_MS = 1000; // 1 second between emails (max 1 email/second)
const MAX_EMAILS_PER_RUN = 55; // Max emails per minute run (leave buffer for processing time)

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

    // Check if queue processing is enabled
    const queueEnabled = await isEmailQueueEnabled();
    if (!queueEnabled) {
      const stats = await getEmailQueueStats();
      return NextResponse.json({
        success: true,
        processed: 0,
        errors: 0,
        stats,
        message: "Email queue is paused",
        timestamp: new Date().toISOString(),
      });
    }

    // Auto-recover any emails stuck in PROCESSING for over 5 seconds
    // (sending takes <1s; anything beyond 5s means the process crashed or timed out)
    await recoverStuckProcessingEmails();

    // Get initial queue stats
    const initialStats = await getEmailQueueStats();

    // If no pending emails, return early
    if (initialStats.pending === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        errors: 0,
        stats: initialStats,
        message: "No emails in queue",
        timestamp: new Date().toISOString(),
      });
    }

    // Process emails one at a time with 1 second delay between each
    // This ensures max 1 email per second rate limit
    let totalProcessed = 0;
    let totalErrors = 0;
    let emailCount = 0;

    while (emailCount < MAX_EMAILS_PER_RUN) {
      const result = await processEmailQueue();
      totalProcessed += result.processed;
      totalErrors += result.errors;
      emailCount++;

      // If no more emails to process, stop early
      if (result.processed === 0 && result.errors === 0) {
        break;
      }

      // Wait 1 second before processing next email (rate limit: 1 email/second)
      if (emailCount < MAX_EMAILS_PER_RUN) {
        await new Promise(resolve => setTimeout(resolve, EMAIL_DELAY_MS));
      }
    }

    // Get final queue stats
    const finalStats = await getEmailQueueStats();

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      errors: totalErrors,
      emailsAttempted: emailCount,
      stats: finalStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    cronEmailQueueLogger.error({ err: String(error) }, "Email queue cron error:");
    return NextResponse.json(
      { error: "Failed to process email queue" },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(req: NextRequest) {
  return GET(req);
}
