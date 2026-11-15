-- Admin MFA (TOTP), sign-in event log, and a durable admin audit table.
-- Response to FBI FLASH-20261113-001 (ARTEX): weak administrative
-- credentials and account takeover are listed initial-access routes, and
-- authentication logs are the first evidence an investigation asks for.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecretEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpPendingSecretEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpLastUsedStep" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpBackupCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "MfaChallenge" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MfaChallenge_userId_idx" ON "MfaChallenge"("userId");
CREATE INDEX IF NOT EXISTS "MfaChallenge_expiresAt_idx" ON "MfaChallenge"("expiresAt");

CREATE TABLE IF NOT EXISTS "LoginEvent" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "email" TEXT NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "success" BOOLEAN NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginEvent_ip_createdAt_idx" ON "LoginEvent"("ip", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginEvent_email_createdAt_idx" ON "LoginEvent"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginEvent_createdAt_idx" ON "LoginEvent"("createdAt");

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id" TEXT PRIMARY KEY,
  "action" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorEmail" TEXT,
  "targetId" TEXT,
  "targetType" TEXT,
  "details" JSONB,
  "changes" JSONB,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetId_idx" ON "AdminAuditLog"("targetId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
