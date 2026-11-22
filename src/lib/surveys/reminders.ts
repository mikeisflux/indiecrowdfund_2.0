/**
 * Automated survey reminders.
 *
 * Late and missing surveys are what throw production counts off: a backer
 * who answers three weeks after the print run was sized either gets the
 * wrong thing or holds everyone up. Until now the only nudge was a creator
 * remembering to press "Send Survey Reminders". This runs on a schedule
 * instead, per campaign, under the survey's own settings:
 *
 *   autoRemind            master switch (Surveys → Sent Surveys → Reminders)
 *   reminderIntervalDays  days between nudges, counted from the send or the
 *                         last nudge
 *   maxReminders          cap per backer
 *   dueAt                 optional deadline; once passed, one final
 *                         "overdue" notice goes out regardless of the cap
 *
 * Honors the backer's "Survey reminders" email preference and the
 * per-project survey mute, and never emails a backer whose survey is done.
 * Each nudge says what is actually missing (an upgrade that needs an item,
 * a shipping address), because "please fill in your survey" is easy to
 * ignore and "we don't know which cover you want in foil" is not.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendSurveyReminderEmail } from "@/lib/email/email-templates-misc";
import { filterUserIdsByEmailPreference } from "@/lib/email/email-preferences";
import { buildModifierQuestions } from "@/lib/fulfillment/modifiers";
import { loadProjectRewardMap } from "@/lib/fulfillment/modifiers-db";

const log = logger.child({ module: "survey-reminders" });

const DAY_MS = 24 * 60 * 60 * 1000;
/** Overdue notice goes out at most once, this long after the deadline window opens. */
const OVERDUE_GRACE_MS = 6 * 60 * 60 * 1000;

export interface ReminderRunResult {
  surveys: number;
  scanned: number;
  sent: number;
  overdueSent: number;
  skipped: number;
}

export async function runSurveyReminders(opts: { now?: Date; perRunLimit?: number } = {}): Promise<ReminderRunResult> {
  const now = opts.now ?? new Date();
  const perRunLimit = opts.perRunLimit ?? 500;
  const result: ReminderRunResult = { surveys: 0, scanned: 0, sent: 0, overdueSent: 0, skipped: 0 };

  const surveys = await db.survey.findMany({
    where: { status: "SENT", autoRemind: true, sentAt: { not: null } },
    select: {
      id: true,
      projectId: true,
      sentAt: true,
      dueAt: true,
      reminderIntervalDays: true,
      maxReminders: true,
    },
  });
  // Survey has no relation to Project in the schema; fetch titles/creators
  // for the campaigns involved in one query.
  const projectRows = await db.project.findMany({
    where: { id: { in: surveys.map((s) => s.projectId) } },
    select: { id: true, title: true, deletedAt: true, creator: { select: { name: true } } },
  });
  const projectById = new Map(projectRows.map((p) => [p.id, p]));

  let budget = perRunLimit;
  for (const survey of surveys) {
    if (budget <= 0) break;
    const project = projectById.get(survey.projectId);
    if (!survey.sentAt || !project || project.deletedAt) continue;
    result.surveys++;

    const intervalMs = Math.max(1, survey.reminderIntervalDays) * DAY_MS;
    const overdueOpen = !!survey.dueAt && survey.dueAt.getTime() <= now.getTime();

    const pledges = await db.pledge.findMany({
      where: {
        projectId: survey.projectId,
        deletedAt: null,
        status: "COMPLETED",
        surveyCompleted: false,
        orderLockStatus: { not: "LOCKED" },
        user: { is: { emailUnsubscribedAt: null, deletedAt: null } },
      },
      select: {
        id: true,
        userId: true,
        rewardId: true,
        surveyReminderCount: true,
        surveyReminderSentAt: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
        addons: { select: { addonId: true, quantity: true } },
        modifierAssignments: { select: { id: true, rewardId: true, projectItemId: true, modifierAddonId: true, unitIndex: true, source: true } },
        surveyResponse: { select: { isComplete: true, shippingAddress: true } },
      },
      orderBy: { surveyReminderSentAt: { sort: "asc", nulls: "first" } },
    });
    if (pledges.length === 0) continue;

    const allowed = await filterUserIdsByEmailPreference(pledges.map((p) => p.userId), "surveyReminders");
    const muted = await db.projectNotificationPreference.findMany({
      where: { projectId: survey.projectId, surveys: false },
      select: { userId: true },
    });
    for (const m of muted) allowed.delete(m.userId);

    const rewardsById = await loadProjectRewardMap(survey.projectId);
    const creatorName = project.creator?.name || "The creator";
    let sentThisSurvey = 0;

    for (const pledge of pledges) {
      if (budget <= 0) break;
      result.scanned++;
      if (pledge.surveyResponse?.isComplete || !pledge.user?.email || !allowed.has(pledge.userId)) {
        result.skipped++;
        continue;
      }

      // Cadence: from the survey send (or the pledge, for late backers who
      // joined after the send) or the last nudge, whichever is later.
      const anchor = Math.max(
        survey.sentAt.getTime(),
        pledge.createdAt.getTime(),
        pledge.surveyReminderSentAt?.getTime() ?? 0,
      );
      const dueForRegular = pledge.surveyReminderCount < survey.maxReminders && now.getTime() - anchor >= intervalMs;

      // One overdue notice once the deadline passes, even past the cap,
      // but never twice: a nudge sent after dueAt counts as the notice.
      const overdueDue =
        overdueOpen &&
        (pledge.surveyReminderSentAt?.getTime() ?? 0) < survey.dueAt!.getTime() &&
        now.getTime() - survey.dueAt!.getTime() >= 0 &&
        now.getTime() - survey.dueAt!.getTime() <= 30 * DAY_MS + OVERDUE_GRACE_MS;

      if (!dueForRegular && !overdueDue) {
        result.skipped++;
        continue;
      }

      const waitingOn = describeWaitingOn(pledge, rewardsById);
      try {
        await sendSurveyReminderEmail(
          pledge.user.email,
          pledge.user.name || "Backer",
          project.title,
          creatorName,
          pledge.id,
          {
            reminderNumber: pledge.surveyReminderCount + 1,
            dueAt: survey.dueAt,
            overdue: overdueDue,
            waitingOn,
          },
        );
        await db.pledge.update({
          where: { id: pledge.id },
          data: { surveyReminderCount: { increment: 1 }, surveyReminderSentAt: now },
        });
        result.sent++;
        if (overdueDue) result.overdueSent++;
        sentThisSurvey++;
        budget--;
      } catch (err) {
        log.warn({ err: String(err), pledgeId: pledge.id }, "Survey reminder failed");
        result.skipped++;
      }
    }

    if (sentThisSurvey > 0) {
      await db.fulfillmentActivity
        .create({
          data: {
            projectId: survey.projectId,
            type: "SURVEY_REMINDER",
            title: `Automatic survey reminder sent to ${sentThisSurvey} backer${sentThisSurvey === 1 ? "" : "s"}`,
          },
        })
        .catch(() => null);
    }
  }

  log.info({ ...result }, "Survey reminder run complete");
  return result;
}

/** Plain-language list of what this backer's unfinished survey still owes. */
function describeWaitingOn(
  pledge: {
    rewardId: string | null;
    addons: { addonId: string; quantity: number }[];
    modifierAssignments: { id: string; rewardId: string; projectItemId: string | null; modifierAddonId: string; unitIndex: number; source: string | null }[];
    surveyResponse: { shippingAddress: unknown } | null;
  },
  rewardsById: Awaited<ReturnType<typeof loadProjectRewardMap>>,
): string[] {
  const out: string[] = [];
  for (const q of buildModifierQuestions({ id: "", rewardId: pledge.rewardId, addons: pledge.addons, modifierAssignments: pledge.modifierAssignments }, rewardsById)) {
    if (q.auto || q.targets.length === 0) continue;
    if (q.selections.some((s) => s === null)) {
      out.push(q.quantity > 1 ? `Which ${q.quantity} items your "${q.title}" upgrades apply to` : `Which item your "${q.title}" applies to`);
    }
  }
  const physical = [pledge.rewardId, ...pledge.addons.map((a) => a.addonId)]
    .filter((id): id is string => !!id)
    .some((id) => rewardsById.get(id)?.shippingType !== "NO_SHIPPING");
  const addr = pledge.surveyResponse?.shippingAddress as { line1?: string } | null | undefined;
  if (physical && !addr?.line1) out.push("Your shipping address");
  out.push("Any size, colour or print choices for your items");
  return out;
}
