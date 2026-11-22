import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { runSurveyReminders } from "@/lib/surveys/reminders";

const cronLogger = logger.child({ module: "cron-survey-reminders" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Automated backer-survey reminders.
//
// For every SENT survey with auto-reminders on, nudges backers whose survey
// is still unfinished on the survey's own cadence (interval, cap, optional
// due date → one overdue notice). See src/lib/surveys/reminders.ts.
//
// Crontab (localhost so a DNS blip can't kill it):
//   30 15 * * * . /root/indiecrowdfund_2.0/.env && \
//     curl -s -H "Authorization: Bearer $CRON_SECRET" \
//     http://localhost:3000/api/cron/survey-reminders > /dev/null 2>&1

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runSurveyReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    cronLogger.error({ err: formatError(error) }, "Survey reminder cron failed");
    return NextResponse.json({ error: "Survey reminder cron failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
