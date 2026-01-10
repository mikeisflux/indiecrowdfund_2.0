-- Bot Protection: Blocked IPs table
CREATE TABLE IF NOT EXISTS "BlockedIP" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ipAddress" TEXT NOT NULL UNIQUE,
    "reason" TEXT NOT NULL,
    "violationCount" INTEGER NOT NULL DEFAULT 1,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUserAgent" TEXT,
    "lastPath" TEXT,
    "lastActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "BlockedIP_ipAddress_idx" ON "BlockedIP"("ipAddress");
CREATE INDEX IF NOT EXISTS "BlockedIP_expiresAt_idx" ON "BlockedIP"("expiresAt");

-- Bot Protection: Suspicious Activity log table
CREATE TABLE IF NOT EXISTS "SuspiciousActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ipAddress" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actionId" TEXT,
    "path" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SuspiciousActivity_ipAddress_idx" ON "SuspiciousActivity"("ipAddress");
CREATE INDEX IF NOT EXISTS "SuspiciousActivity_createdAt_idx" ON "SuspiciousActivity"("createdAt");
