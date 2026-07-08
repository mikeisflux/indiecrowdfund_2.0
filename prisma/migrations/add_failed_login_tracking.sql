-- Failed login tracking for brute-force detection and admin security stats
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastFailedLoginAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_lastFailedLoginAt_idx" ON "User"("lastFailedLoginAt");
