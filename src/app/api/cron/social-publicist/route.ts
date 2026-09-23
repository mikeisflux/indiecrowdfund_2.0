import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateSocialPosts, publishApprovedPosts } from "@/lib/social/publicist";

const cronSocialLogger = logger.child({ module: "cron-social-publicist" });

// AI Publicist cron — the outward-advertising counterpart to
// /api/cron/ai-marketing.
//
// Each tick runs two phases:
//   1. generate — detect postable moments (launches, milestones,
//      ending-soon, Sunday roundup) and queue AI-written posts
//   2. publish  — post APPROVED queue entries to X (max 2 per tick)
//
// Schedule hourly:
//   0 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://indiecrowdfund.com/api/cron/social-publicist
//
// Master switch: Admin Settings > Social > "Auto-Post on Project
// Launch" (autoPostEnabled). With "Require Post Approval" on, posts
// wait in /admin/social-publicist; off, they go out on the next tick.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const generated = await generateSocialPosts();
    const published = await publishApprovedPosts();

    const message = `Queued ${generated.queued} post(s), published ${published.posted}, ${published.failed} failed`;
    cronSocialLogger.info({ generated, published }, "Social publicist tick complete");

    await db.aiRunLog
      .create({
        data: {
          action: "runSocialPublicist",
          serviceId: "social-publicist",
          success: published.failed === 0,
          message,
          resultJson: { generated, published } as object,
          trigger: "cron",
          durationMs: Date.now() - startedAt,
        },
      })
      .catch((e: unknown) =>
        cronSocialLogger.error({ err: formatError(e) }, "Failed to write AI run log")
      );

    return NextResponse.json({ ok: true, generated, published });
  } catch (error) {
    cronSocialLogger.error({ err: formatError(error) }, "Social publicist cron error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
