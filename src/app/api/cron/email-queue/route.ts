import { NextRequest, NextResponse } from "next/server";
import { processEmailQueue, getEmailQueueStats, isEmailQueueEnabled } from "@/lib/email";

// Cron job endpoint for processing the email queue
//
// This should be called by a cron service every second for rate limiting
// Or can be called less frequently and process multiple emails with delays
//
// Schedule: Every minute (processes up to 60 emails with 1s delays)
//
// Example Vercel cron config (vercel.json):
// { "crons": [{ "path": "/api/cron/email-queue", "schedule": "* * * * *" }] }
//
// Security: Protected by CRON_SECRET environment variable

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for processing

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

    // Process up to 55 emails with 1-second delays (leaving 5s buffer)
    // This ensures we stay within the 60-second timeout and respect rate limits
    const maxToProcess = Math.min(initialStats.pending, 55);
    let totalProcessed = 0;
    let totalErrors = 0;

    for (let i = 0; i < maxToProcess; i++) {
      const result = await processEmailQueue();
      totalProcessed += result.processed;
      totalErrors += result.errors;

      // If no more emails to process, stop early
      if (result.processed === 0 && result.errors === 0) {
        break;
      }

      // Wait 1 second before processing next email (rate limiting)
      if (i < maxToProcess - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Get final queue stats
    const finalStats = await getEmailQueueStats();

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      errors: totalErrors,
      stats: finalStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Email queue cron error:", error);
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
