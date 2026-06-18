import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";

const devCalendarSeedLogger = logger.child({ module: "admin-dev-calendar-seed" });

export const dynamic = "force-dynamic";

// POST /api/admin/dev-calendar/seed
//   Idempotent seeding for the canonical first notes -- the DC
//   chargeback-ban Phase 2 cutover reminder + the cron job
//   schedule documentation. Re-run safe (each entry is matched by
//   title and only inserted if absent).
export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    sevenDaysOut.setHours(10, 0, 0, 0); // 10am local

    type SeedEntry = {
      title: string;
      data: {
        type: "NOTE" | "REMINDER" | "JOB_SCHEDULE";
        title: string;
        description?: string;
        scheduledFor?: Date | null;
        cronExpression?: string;
        link?: string;
        status?: "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED";
        tags?: string[];
      };
    };
    const seeds: SeedEntry[] = [
      {
        title: "Check DC chargeback-ban prefilter false positives + flip to enforce",
        data: {
          type: "REMINDER",
          title: "Check DC chargeback-ban prefilter false positives + flip to enforce",
          scheduledFor: sevenDaysOut,
          status: "PENDING",
          tags: ["chargeback", "divinitycoin", "ops"],
          link: "/docs/divinitycoin-chargeback-ban-prefilter-spec.md",
          description: [
            "DivinityCoin's chargeback-ban prefilter is running in log_only mode",
            "since Phase 1 went live on " + now.toISOString().slice(0, 10) + ".",
            "",
            "Today:",
            "  1. Email DC engineering and ask for the match-log report from",
            "     log_only mode (count of would-have-blocked events, broken down",
            "     by signal type: card_fingerprint / email / phone / name+address).",
            "  2. If zero false positives, ask them to flip",
            "     CHARGEBACK_BAN_MODE=log_only -> enforce on their box, restart",
            "     PM2 with --update-env.",
            "  3. From that moment any matched charge gets a hard 402 instead",
            "     of just being logged.",
            "",
            "If false positives are non-zero, work with DC to tune the",
            "match rules (downgrade specific signals from hard-block to",
            "soft-flag) before flipping.",
            "",
            "Spec: /docs/divinitycoin-chargeback-ban-prefilter-spec.md",
            "Feed endpoint: /api/divinitycoin/chargeback-ban-signals",
            "Report-back: /api/divinitycoin/chargeback-ban-blocked",
          ].join("\n"),
        },
      },
      {
        title: "Cron: enforce-chargeback-bans (every 10 min)",
        data: {
          type: "JOB_SCHEDULE",
          title: "Cron: enforce-chargeback-bans (every 10 min)",
          cronExpression: "*/10 * * * *",
          scheduledFor: now,
          status: "IN_PROGRESS",
          tags: ["chargeback", "cron", "ops"],
          description: [
            "POST /api/cron/enforce-chargeback-bans",
            "",
            "Loads every User with lockedReason containing 'chargeback',",
            "builds banned-email + banned-IP sets, finds active accounts",
            "matching either, locks them, drops their sessions, and adds",
            "their IP to IPBlocklist.",
            "",
            "Crontab line on the prod box:",
            "  */10 * * * * curl -fsS -X POST -H \"Authorization: Bearer $CRON_SECRET\" https://indiecrowdfund.com/api/cron/enforce-chargeback-bans > /dev/null",
            "",
            "Verify it's actually firing:",
            "  pm2 logs --lines 200 --nostream | grep cron-enforce-chargeback-bans | tail",
          ].join("\n"),
        },
      },
    ];

    const results: Array<{ title: string; created: boolean; id?: string }> = [];
    for (const seed of seeds) {
      const existing = await db.devCalendarEntry.findFirst({
        where: { title: seed.title },
        select: { id: true },
      });
      if (existing) {
        results.push({ title: seed.title, created: false, id: existing.id });
        continue;
      }
      const created = await db.devCalendarEntry.create({ data: seed.data });
      results.push({ title: seed.title, created: true, id: created.id });
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    devCalendarSeedLogger.error({ err: formatError(error) }, "Seed failed");
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
