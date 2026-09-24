import { db } from "@/lib/db";

/**
 * Per-project IndieKit settings (Project.indiekitSettings JSON).
 *
 * These back the Settings > Survey / Payments / Notifications toggles,
 * which previously posted to a nonexistent API action and gated
 * nothing. Every switch here is read by a real code path:
 *
 *  payments.autoRetry           — the funded-campaign charge cron skips
 *                                 backoff retries for the project
 *  payments.sendReceipts        — gates the pledge confirmation/receipt
 *                                 email
 *  payments.failedNotifications — gates the backer "payment failed"
 *                                 email
 *  survey.sendConfirmationEmail — gates the survey-completed email
 *  survey.allowAddressChanges   — backers may edit their shipping
 *                                 address after submitting the survey
 *  notifications.surveyCompletions / failedPayments / newPreorders
 *                               — creator in-app notifications for those
 *                                 events
 *  notifications.dailySummary   — daily digest email from
 *                                 /api/cron/creator-daily-summary
 */

export interface IndiekitSettings {
  survey: {
    allowAddressChanges: boolean;
    sendConfirmationEmail: boolean;
  };
  payments: {
    autoRetry: boolean;
    sendReceipts: boolean;
    failedNotifications: boolean;
  };
  notifications: {
    surveyCompletions: boolean;
    failedPayments: boolean;
    newPreorders: boolean;
    dailySummary: boolean;
  };
}

export const INDIEKIT_SETTINGS_DEFAULTS: IndiekitSettings = {
  survey: {
    allowAddressChanges: true,
    sendConfirmationEmail: true,
  },
  payments: {
    autoRetry: true,
    sendReceipts: true,
    failedNotifications: true,
  },
  notifications: {
    surveyCompletions: false,
    failedPayments: true,
    newPreorders: true,
    dailySummary: false,
  },
};

type SectionKey = keyof IndiekitSettings;

function mergeSection<K extends SectionKey>(
  key: K,
  stored: unknown
): IndiekitSettings[K] {
  const defaults = INDIEKIT_SETTINGS_DEFAULTS[key];
  const raw = (stored as Record<string, Record<string, unknown>> | null)?.[key];
  if (!raw || typeof raw !== "object") return { ...defaults };
  const merged = { ...defaults } as Record<string, boolean>;
  for (const [field, value] of Object.entries(raw)) {
    if (field in defaults && typeof value === "boolean") merged[field] = value;
  }
  return merged as IndiekitSettings[K];
}

export function parseIndiekitSettings(stored: unknown): IndiekitSettings {
  return {
    survey: mergeSection("survey", stored),
    payments: mergeSection("payments", stored),
    notifications: mergeSection("notifications", stored),
  };
}

// Senders on hot paths (webhooks, crons) read one section at a time;
// keep it to a single narrow select. Any failure means defaults — a
// settings read must never take down a payment path.
export async function getIndiekitSettings(projectId: string): Promise<IndiekitSettings> {
  try {
    const project = await db.project.findFirst({
      where: { id: projectId },
      select: { indiekitSettings: true },
    });
    return parseIndiekitSettings(project?.indiekitSettings ?? null);
  } catch {
    return { ...INDIEKIT_SETTINGS_DEFAULTS };
  }
}

/** Merge one section's fields into the stored JSON (unknown keys dropped). */
export async function updateIndiekitSettings(
  projectId: string,
  section: SectionKey,
  settings: Record<string, unknown>
): Promise<IndiekitSettings> {
  const project = await db.project.findFirst({
    where: { id: projectId },
    select: { indiekitSettings: true },
  });
  const current = parseIndiekitSettings(project?.indiekitSettings ?? null);
  const defaults = INDIEKIT_SETTINGS_DEFAULTS[section] as Record<string, boolean>;
  const next = { ...(current[section] as Record<string, boolean>) };
  for (const [field, value] of Object.entries(settings)) {
    if (field in defaults && typeof value === "boolean") next[field] = value;
  }
  const updated = { ...current, [section]: next };
  await db.project.update({
    where: { id: projectId },
    data: { indiekitSettings: updated as unknown as object },
  });
  return updated as IndiekitSettings;
}
