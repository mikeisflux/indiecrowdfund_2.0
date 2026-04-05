/**
 * Structured audit logging for sensitive admin actions.
 * Outputs JSON to stdout for log aggregation (CloudWatch, Datadog, etc.)
 */

import { logger } from "@/lib/logger";

const auditLogger = logger.child({ _type: "AUDIT" });

export type AuditAction =
  | "USER_ROLE_CHANGE"
  | "USER_BAN"
  | "USER_UNBAN"
  | "USER_LOCK"
  | "USER_UNLOCK"
  | "USER_DELETE"
  | "USER_PASSWORD_SET"
  | "USER_PASSWORD_RESET"
  | "USER_EMAIL_CHANGE"
  | "USER_EMAIL_VERIFY"
  | "USER_CREATE"
  | "PROJECT_APPROVE"
  | "PROJECT_REJECT"
  | "PROJECT_DEACTIVATE"
  | "PROJECT_REACTIVATE"
  | "PROJECT_MAKE_LIVE"
  | "PAYOUT_CREATE"
  | "PAYOUT_PROCESS"
  | "PAYOUT_COMPLETE"
  | "PAYOUT_FAIL"
  | "PAYOUT_RETRY"
  | "PAYOUT_CANCEL"
  | "BANK_ACCOUNT_VIEW"
  | "IP_BLOCK"
  | "IP_UNBLOCK"
  | "SETTINGS_CHANGE"
  | "ENCRYPTION_KEY_CHANGE"
  | "PAYOUT_SETTINGS_CHANGE"
  | "API_KEY_CHANGE";

// Fields that should have their values masked in audit logs
const SENSITIVE_FIELDS = new Set([
  "stripeSecretKey", "stripeWebhookSecret", "stripeConnectWebhookSecret",
  "stripePublishableKey", "divinityCoinApiKey", "divinityCoinWebhookSecret",
  "divinityCoinStripePublishableKey", "smtpPassword", "sendgridApiKey",
  "sendgridWebhookVerificationKey", "mailgunApiKey", "mailgunWebhookSigningKey",
  "anthropicApiKey", "googlePlacesApiKey", "facebookAppSecret",
  "facebookPageAccessToken", "youtubeClientSecret", "youtubeApiKey",
  "twitterApiKey", "twitterApiSecret", "twitterBearerToken",
  "twitterAccessToken", "twitterAccessSecret", "stabilityApiKey",
  "shuftiSecretKey", "r2AccessKeyId", "r2SecretAccessKey",
  "recaptchaSecretKey", "shopifyApiKey", "shopifyApiSecret",
  "shopifyAccessToken", "password", "encryptionKey",
]);

function maskValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "<empty>";
  if (SENSITIVE_FIELDS.has(field)) {
    const str = String(value);
    if (str.length <= 4) return "****";
    return `${str.slice(0, 4)}****`;
  }
  return String(value);
}

interface AuditEntry {
  action: AuditAction;
  actorId: string;
  actorEmail?: string;
  targetId?: string;
  targetType?: "USER" | "PROJECT" | "PAYOUT" | "IP" | "SETTINGS";
  details?: Record<string, unknown>;
  changes?: Record<string, { from: unknown; to: unknown }>;
}

export function auditLog(entry: AuditEntry): void {
  // Mask sensitive field values in changes
  let maskedChanges: Record<string, { from: string; to: string }> | undefined;
  if (entry.changes) {
    maskedChanges = {};
    for (const [field, { from, to }] of Object.entries(entry.changes)) {
      maskedChanges[field] = {
        from: maskValue(field, from),
        to: maskValue(field, to),
      };
    }
  }

  auditLogger.info({
    action: entry.action,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    targetId: entry.targetId,
    targetType: entry.targetType,
    details: entry.details,
    changes: maskedChanges,
  }, `${entry.action}${entry.targetId ? ` on ${entry.targetType}:${entry.targetId}` : ""}`);
}

/**
 * Compute changes between old and new values.
 * Only includes fields that actually changed.
 */
export function computeChanges(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const [key, newVal] of Object.entries(newValues)) {
    const oldVal = oldValues[key];
    // Skip if values are equal (handle null/undefined equivalence)
    if (oldVal === newVal) continue;
    if (oldVal == null && newVal == null) continue;
    changes[key] = { from: oldVal, to: newVal };
  }

  return changes;
}
