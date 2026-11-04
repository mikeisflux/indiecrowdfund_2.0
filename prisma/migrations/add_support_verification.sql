-- Migration: support chat identity verification codes
-- Applied automatically by build-and-swap.sh; by hand (auth via ~/.pgpass):
--   psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_support_verification.sql

CREATE TABLE IF NOT EXISTS "SupportVerification" (
  "id"         TEXT NOT NULL,
  "chatToken"  TEXT NOT NULL,
  "email"      TEXT NOT NULL,
  "userId"     TEXT,
  "codeHash"   TEXT NOT NULL,
  "attempts"   INTEGER NOT NULL DEFAULT 0,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "ip"         TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportVerification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SupportVerification_chatToken_createdAt_idx" ON "SupportVerification"("chatToken", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportVerification_email_createdAt_idx" ON "SupportVerification"("email", "createdAt");
