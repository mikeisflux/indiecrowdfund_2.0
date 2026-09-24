import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const prefsLogger = logger.child({ module: "email-preferences" });

/**
 * Per-user email preferences (Settings > Subscriptions).
 *
 * The 12 toggles were saved to UserPreference.emailPreferences and read
 * by nothing — every sender emailed regardless. These helpers are the
 * read side; each key gates the sender(s) noted:
 *
 *   backedProjectUpdates  update emails on projects the user backed
 *   projectUpdates        update emails on projects/creators they follow
 *   projectFunded         "project funded" celebration email
 *   commentReplies        comment-reply email
 *   surveyReminders       backer survey reminder email
 *   creatorMessages       one-off creator emails + creator campaigns
 *   creatorLaunches       launch emails from followed creators/projects
 *   newProjects / endingSoon / fundingMilestones / weeklyDigest /
 *   marketingEmails       AI-marketing automation campaigns
 *
 * All keys default ON — an absent row or key means the user never
 * touched the setting. Failures also default ON for transactional-ish
 * mail: a preferences hiccup must not silently drop notices, and the
 * hard opt-outs (emailUnsubscribedAt etc.) are enforced separately by
 * MARKETING_RECIPIENT_WHERE.
 */

export type EmailPreferenceKey =
  | "backedProjectUpdates"
  | "projectFunded"
  | "commentReplies"
  | "surveyReminders"
  | "creatorMessages"
  | "projectUpdates"
  | "creatorLaunches"
  | "newProjects"
  | "endingSoon"
  | "fundingMilestones"
  | "weeklyDigest"
  | "marketingEmails";

function keyEnabled(prefs: unknown, key: EmailPreferenceKey): boolean {
  if (!prefs || typeof prefs !== "object") return true;
  const value = (prefs as Record<string, unknown>)[key];
  return value !== false;
}

/** One user's toggle. */
export async function isEmailPreferenceEnabled(
  userId: string,
  key: EmailPreferenceKey
): Promise<boolean> {
  try {
    const row = await db.userPreference.findUnique({
      where: { userId },
      select: { emailPreferences: true },
    });
    return keyEnabled(row?.emailPreferences, key);
  } catch (err) {
    prefsLogger.warn({ err: String(err), userId, key }, "Preference read failed; defaulting on");
    return true;
  }
}

/**
 * Batch filter: the subset of userIds whose toggle for `key` is on.
 * One query regardless of list size.
 */
export async function filterUserIdsByEmailPreference(
  userIds: string[],
  key: EmailPreferenceKey
): Promise<Set<string>> {
  const allowed = new Set(userIds);
  if (userIds.length === 0) return allowed;
  try {
    const rows = await db.userPreference.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, emailPreferences: true },
    });
    for (const row of rows) {
      if (!keyEnabled(row.emailPreferences, key)) allowed.delete(row.userId);
    }
  } catch (err) {
    prefsLogger.warn({ err: String(err), key }, "Batch preference read failed; defaulting on");
  }
  return allowed;
}

/** Same filter keyed by email address (for senders that only have emails). */
export async function filterEmailsByEmailPreference(
  emails: string[],
  key: EmailPreferenceKey
): Promise<Set<string>> {
  const allowed = new Set(emails.map((e) => e.toLowerCase()));
  if (emails.length === 0) return allowed;
  try {
    const users = await db.user.findMany({
      where: { email: { in: emails, mode: "insensitive" } },
      select: { id: true, email: true, preferences: { select: { emailPreferences: true } } },
    });
    for (const user of users) {
      if (user.email && !keyEnabled(user.preferences?.emailPreferences, key)) {
        allowed.delete(user.email.toLowerCase());
      }
    }
  } catch (err) {
    prefsLogger.warn({ err: String(err), key }, "Email preference read failed; defaulting on");
  }
  return allowed;
}
