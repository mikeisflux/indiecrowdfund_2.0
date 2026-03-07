/**
 * Structured audit logging for sensitive admin actions.
 * Outputs JSON to stdout for log aggregation (CloudWatch, Datadog, etc.)
 */

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
  | "PAYOUT_CANCEL"
  | "BANK_ACCOUNT_VIEW"
  | "IP_BLOCK"
  | "IP_UNBLOCK";

interface AuditEntry {
  action: AuditAction;
  actorId: string;
  actorEmail?: string;
  targetId?: string;
  targetType?: "USER" | "PROJECT" | "PAYOUT" | "IP";
  details?: Record<string, unknown>;
}

export function auditLog(entry: AuditEntry): void {
  const log = {
    _type: "AUDIT",
    timestamp: new Date().toISOString(),
    ...entry,
  };
  console.log(JSON.stringify(log));
}
