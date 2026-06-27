import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";
import { POST as runAiService } from "@/app/api/admin/ai-marketing/run/route";

const cronAiServicesLogger = logger.child({ module: "cron-ai-services" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// AI per-service scheduler.
//
// The admin AI Control Center "CRON Job Scheduler" UI lets an operator
// schedule individual services (Auto-Tagging @ 2AM, Predictive @ 3AM,
// Smart Segmentation weekly, Send-Time @ 1AM) with per-service cron
// expressions, saved to platformSettings.aiCronSchedules. Nothing
// previously executed those schedules — they were stored only. This
// route is the executor.
//
// Call it FREQUENTLY from the OS crontab (every 15 min is plenty):
//   */15 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
//     https://indiecrowdfund.com/api/cron/ai-services
//
// On each tick it loads the saved schedules and, for every enabled
// one that has become due since its last cron run, invokes the SAME
// run handler the manual "Run Now" button uses (reused directly, not
// reimplemented) with the x-cron-trigger header so the run is logged
// to AiRunLog tagged "cron".

// Map the UI service ids to run-endpoint actions. Only these are
// schedulable from the UI; anything else in the saved schedule is
// skipped.
const ACTION_BY_SERVICE: Record<string, string> = {
  "auto-tagging": "runAutoTagging",
  "predictive-analytics": "runPredictiveAnalytics",
  "smart-segmentation": "runSegmentation",
  "send-time-optimization": "runSendTimeOptimization",
  "user-profiling": "runUserProfiling",
  "automation": "runAutomation",
};

// --- Minimal cron matcher (5-field: minute hour dom month dow) ---
// Supports the syntax the UI emits: *, */N, A-B, A,B,C, and integers.
// dow is 0-6 with 0 = Sunday. Evaluated against LOCAL server time so
// "Daily at 2:00 AM" matches 02:00 local (the UI labels are local).
function fieldMatches(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;
  for (const part of field.split(",")) {
    if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      if (!step || step < 1) continue;
      const lo = range === "*" ? min : parseInt(range.split("-")[0], 10);
      const hi = range === "*" || !range.includes("-") ? max : parseInt(range.split("-")[1], 10);
      for (let v = lo; v <= hi; v += step) {
        if (v === value) return true;
      }
    } else if (part.includes("-")) {
      const [lo, hi] = part.split("-").map((n) => parseInt(n, 10));
      if (value >= lo && value <= hi) return true;
    } else {
      if (parseInt(part, 10) === value) return true;
    }
  }
  return false;
}

function cronMatches(expr: string, d: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [min, hour, dom, month, dow] = parts;
  return (
    fieldMatches(min, d.getMinutes(), 0, 59) &&
    fieldMatches(hour, d.getHours(), 0, 23) &&
    fieldMatches(dom, d.getDate(), 1, 31) &&
    fieldMatches(month, d.getMonth() + 1, 1, 12) &&
    fieldMatches(dow, d.getDay(), 0, 6)
  );
}

// Did a scheduled fire occur in (windowStart, now]? Walk minute by
// minute backward from now to windowStart; stop at first match. Cap
// the walk so a never-run monthly schedule can't iterate unbounded.
function isDue(expr: string, windowStartMs: number, nowMs: number): boolean {
  const MAX_MINUTES = 40 * 24 * 60; // 40 days
  let t = Math.floor(nowMs / 60000) * 60000; // truncate to minute
  let steps = 0;
  while (t > windowStartMs && steps < MAX_MINUTES) {
    if (cronMatches(expr, new Date(t))) return true;
    t -= 60000;
    steps += 1;
  }
  return false;
}

interface SavedSchedule {
  id: string;
  service: string;
  schedule: string;
  enabled: boolean;
}

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await db.platformSettings.findFirst({
      select: { aiCronSchedules: true },
    });
    if (!settings?.aiCronSchedules) {
      return NextResponse.json({ ok: true, message: "No schedules configured", ran: [] });
    }

    let schedules: SavedSchedule[] = [];
    try {
      schedules = JSON.parse(settings.aiCronSchedules);
    } catch {
      return NextResponse.json({ ok: false, error: "aiCronSchedules is not valid JSON" }, { status: 500 });
    }

    const now = Date.now();
    const ran: Array<{ service: string; action: string; due: boolean; ok?: boolean; message?: string }> = [];

    for (const sched of schedules) {
      if (!sched.enabled) continue;
      const action = ACTION_BY_SERVICE[sched.service];
      if (!action) continue; // unknown / non-schedulable service

      // Window start = last cron run for this service, else 24h ago
      // (32 days for monthly-looking schedules so a first run isn't
      // missed).
      const lastCronRun = await db.aiRunLog.findFirst({
        where: { serviceId: sched.service, trigger: "cron" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      const looksMonthly = /^\S+\s+\S+\s+(?!\*)\S/.test(sched.schedule); // day-of-month set
      const defaultWindowMs = (looksMonthly ? 32 : 1) * 24 * 60 * 60 * 1000;
      const windowStartMs = lastCronRun
        ? lastCronRun.createdAt.getTime()
        : now - defaultWindowMs;

      const due = isDue(sched.schedule, windowStartMs, now);
      if (!due) {
        continue;
      }

      // Invoke the SAME run handler the UI uses — reuse, not
      // reimplement. It writes the AiRunLog row (tagged cron via the
      // header) and applies all the per-service settings checks.
      try {
        const fakeReq = new Request("http://internal/api/admin/ai-marketing/run", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${cronSecret}`,
            "x-cron-trigger": "1",
          },
          body: JSON.stringify({ action }),
        });
        const res = await runAiService(fakeReq);
        const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; error?: string };
        ran.push({
          service: sched.service,
          action,
          due: true,
          ok: res.ok && data.success !== false,
          message: data.message || data.error,
        });
      } catch (e) {
        cronAiServicesLogger.error({ err: formatError(e), service: sched.service }, "AI service run threw");
        ran.push({ service: sched.service, action, due: true, ok: false, message: "exception" });
      }
    }

    cronAiServicesLogger.info({ ranCount: ran.length, ran }, "AI services scheduler tick complete");
    return NextResponse.json({ ok: true, ran });
  } catch (error) {
    cronAiServicesLogger.error({ err: formatError(error) }, "AI services scheduler failed");
    return NextResponse.json({ error: "Scheduler failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
