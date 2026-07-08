import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { runAutomatedMarketing } from "@/lib/ai/automation";

const cronAiMarketingLogger = logger.child({ module: "cron-ai-marketing" });

// Automated AI Marketing Cron
//
// Runs the full marketing automation orchestrator:
// 1. Refreshes user interest profiles
// 2. Generates smart segments
// 3. Creates and sends targeted campaigns (weekly discovery, new projects, ending soon, win-back)
// 4. Uses past campaign performance to improve future content
//
// Schedule: Daily at 10:00 AM (outside quiet hours)
//   0 10 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/ai-marketing
//
// Security: Protected by CRON_SECRET environment variable

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 2 minutes for AI calls

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    cronAiMarketingLogger.info("Starting automated AI marketing run");

    const startedAt = Date.now();
    const result = await runAutomatedMarketing();

    cronAiMarketingLogger.info(
      {
        success: result.success,
        campaigns: result.campaignsCreated,
        emails: result.emailsQueued,
        duration: result.duration,
        errors: result.errors.length,
      },
      "AI marketing automation complete"
    );

    // Record in the AI run log so the admin Run History tab shows the
    // automated daily marketing run alongside the per-service runs.
    await db.aiRunLog.create({
      data: {
        action: "runAutomation",
        serviceId: "automation",
        success: result.success !== false,
        message: `Created ${result.campaignsCreated ?? 0} campaigns, queued ${result.emailsQueued ?? 0} emails${result.errors?.length ? `, ${result.errors.length} errors` : ""}`,
        resultJson: { success: result.success, campaignsCreated: result.campaignsCreated, emailsQueued: result.emailsQueued, errors: result.errors?.slice(0, 20) } as object,
        trigger: "cron",
        durationMs: Date.now() - startedAt,
      },
    }).catch((e: unknown) => cronAiMarketingLogger.error({ err: formatError(e) }, "Failed to write AI run log"));

    return NextResponse.json(result);
  } catch (error) {
    cronAiMarketingLogger.error({ err: formatError(error) }, "AI marketing cron error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
