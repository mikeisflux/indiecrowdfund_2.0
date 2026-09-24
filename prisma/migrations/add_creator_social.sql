-- Creator Social Hub: per-creator X posting (see prisma/schema/creator-social.prisma).
-- The dashboard's Social Hub tab previously faked every action; these tables
-- back the real version — creator-connected X credentials and a post queue
-- published by /api/cron/social-publicist.

CREATE TABLE IF NOT EXISTS "CreatorSocialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'twitter',
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "accessSecret" TEXT NOT NULL,
    "handle" TEXT,
    "autoPostEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreatorSocialAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorSocialAccount_userId_platform_key"
    ON "CreatorSocialAccount"("userId", "platform");

CREATE TABLE IF NOT EXISTS "CreatorSocialPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'twitter',
    "projectId" TEXT,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "dedupeKey" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "error" TEXT,
    "externalId" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreatorSocialPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorSocialPost_dedupeKey_key"
    ON "CreatorSocialPost"("dedupeKey");
CREATE INDEX IF NOT EXISTS "CreatorSocialPost_status_scheduledFor_idx"
    ON "CreatorSocialPost"("status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "CreatorSocialPost_userId_createdAt_idx"
    ON "CreatorSocialPost"("userId", "createdAt");
