import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { queueEmail, EMAIL_PRIORITY } from "@/lib/email";
import { escapeHtmlForEmail } from "@/lib/email/email-config";
import { parseIndiekitSettings } from "@/lib/indiekit-settings";

const dailySummaryLogger = logger.child({ module: "cron-creator-daily-summary" });

// Creator Daily Summary
//
// Backs the IndieKit Settings > Notifications > "Daily Summary" toggle,
// which shipped with no sender behind it. One digest email per creator
// covering the last 24 hours of every campaign that has the toggle on:
// new pledges (with totals), completed surveys, and failed charges.
// Nothing happened on any opted-in campaign -> no email.
//
// Schedule: daily, e.g. 8:00 AM
//   0 8 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/creator-daily-summary

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // The toggle defaults off, so only projects with a stored settings
    // JSON can qualify. Json-null filtering in Prisma needs DbNull
    // sentinels and throws on plain null, so filter in JS instead — the
    // select is narrow and the project table is small.
    const candidates = await db.project.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        title: true,
        creatorId: true,
        indiekitSettings: true,
        creator: { select: { email: true, name: true, deletedAt: true } },
      },
    });
    const optedIn = candidates.filter(
      (p: (typeof candidates)[number]) =>
        p.indiekitSettings != null &&
        parseIndiekitSettings(p.indiekitSettings).notifications.dailySummary &&
        p.creator?.email &&
        !p.creator.deletedAt
    );
    if (optedIn.length === 0) {
      return NextResponse.json({ ok: true, creatorsEmailed: 0, projects: 0 });
    }

    // Group by creator: one digest per person, not per campaign.
    const byCreator = new Map<string, typeof optedIn>();
    for (const p of optedIn) {
      const list = byCreator.get(p.creatorId) ?? [];
      list.push(p);
      byCreator.set(p.creatorId, list);
    }

    let creatorsEmailed = 0;
    for (const projects of byCreator.values()) {
      const sections: string[] = [];
      for (const project of projects) {
        const [newPledges, surveysCompleted, failedCharges] = await Promise.all([
          db.pledge.aggregate({
            where: {
              projectId: project.id,
              deletedAt: null,
              status: "COMPLETED",
              createdAt: { gte: since },
            },
            _count: true,
            _sum: { amount: true },
          }),
          db.surveyResponse.count({
            where: {
              pledge: { projectId: project.id, deletedAt: null },
              isComplete: true,
              completedAt: { gte: since },
            },
          }),
          db.pledge.count({
            where: {
              projectId: project.id,
              deletedAt: null,
              status: "FAILED",
              updatedAt: { gte: since },
            },
          }),
        ]);

        const pledgeCount = newPledges._count;
        if (pledgeCount === 0 && surveysCompleted === 0 && failedCharges === 0) continue;

        const rows: string[] = [];
        if (pledgeCount > 0) {
          rows.push(
            `<li>${pledgeCount} new pledge${pledgeCount === 1 ? "" : "s"} — $${Number(newPledges._sum.amount ?? 0).toFixed(2)}</li>`
          );
        }
        if (surveysCompleted > 0) {
          rows.push(`<li>${surveysCompleted} survey${surveysCompleted === 1 ? "" : "s"} completed</li>`);
        }
        if (failedCharges > 0) {
          rows.push(`<li>${failedCharges} payment${failedCharges === 1 ? "" : "s"} failed</li>`);
        }
        sections.push(
          `<h3 style="margin: 16px 0 4px;">${escapeHtmlForEmail(project.title)}</h3><ul style="margin: 0; padding-left: 20px;">${rows.join("")}</ul>`
        );
      }

      if (sections.length === 0) continue;

      const creator = projects[0].creator!;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
      const html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your daily campaign summary</h2>
        <p>Here's what happened in the last 24 hours:</p>
        ${sections.join("")}
        <p style="margin-top: 24px;"><a href="${appUrl}/dashboard/indiekit" style="color: #0d9488;">Open IndieKit</a></p>
        <p style="margin-top: 16px; font-size: 12px; color: #888;">You get this because Daily Summary is on under IndieKit Settings &gt; Notifications. Turn it off there any time.</p>
      </div>`;

      const result = await queueEmail({
        to: creator.email!,
        subject: "Your daily campaign summary — IndieCrowdfund",
        html,
        priority: EMAIL_PRIORITY.CREATOR,
      });
      if (result.success) creatorsEmailed++;
    }

    dailySummaryLogger.info(
      { creatorsEmailed, optedInProjects: optedIn.length, durationMs: Date.now() - startedAt },
      "Creator daily summary run complete"
    );
    return NextResponse.json({ ok: true, creatorsEmailed, projects: optedIn.length });
  } catch (error) {
    dailySummaryLogger.error({ err: formatError(error) }, "Creator daily summary failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
