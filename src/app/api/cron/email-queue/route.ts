import { NextRequest, NextResponse } from "next/server";
import { processEmailBatch, getEmailQueueStats, isEmailQueueEnabled } from "@/lib/email";

// Cron job endpoint for processing the email queue
//
// Optimized for parallel batch processing while respecting rate limits
// Processes up to 200 emails per run (20 batches x 10 emails)
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

// Configuration for batch processing
const BATCH_SIZE = 10; // Process 10 emails in parallel per batch
const BATCH_DELAY_MS = 2000; // 2 second delay between batches (for rate limiting)
const MAX_BATCHES = 20; // Max 20 batches per run = 200 emails max

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

    // Process emails in batches
    // Each batch processes BATCH_SIZE emails in parallel
    let totalProcessed = 0;
    let totalErrors = 0;
    let batchCount = 0;

    while (batchCount < MAX_BATCHES) {
      const result = await processEmailBatch(BATCH_SIZE);
      totalProcessed += result.processed;
      totalErrors += result.errors;
      batchCount++;

      // If no more emails to process, stop early
      if (result.processed === 0 && result.errors === 0) {
        break;
      }

      // Wait between batches to respect rate limits
      if (batchCount < MAX_BATCHES) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Get final queue stats
    const finalStats = await getEmailQueueStats();

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      errors: totalErrors,
      batchesProcessed: batchCount,
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
