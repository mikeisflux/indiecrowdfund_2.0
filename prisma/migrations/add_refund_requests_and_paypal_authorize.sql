-- Migration: Add RefundRequest model and PayPal authorization + Whop payment ID fields

-- Add PayPal authorization ID for deferred capture (when campaign not yet funded)
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "paypalAuthorizationId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Pledge_paypalAuthorizationId_key" ON "Pledge"("paypalAuthorizationId");

-- Add Whop payment ID for SDK-based refunds (populated from payment.succeeded webhook)
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "whopPaymentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Pledge_whopPaymentId_key" ON "Pledge"("whopPaymentId");

-- Add RefundRequestStatus enum
DO $$ BEGIN
  CREATE TYPE "RefundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create RefundRequest table
CREATE TABLE IF NOT EXISTS "RefundRequest" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "pledgeId"    TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "projectId"   TEXT NOT NULL,
  "reason"      TEXT NOT NULL,
  "status"      "RefundRequestStatus" NOT NULL DEFAULT 'PENDING',
  "creatorNote" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one refund request per pledge
CREATE UNIQUE INDEX IF NOT EXISTS "RefundRequest_pledgeId_key" ON "RefundRequest"("pledgeId");

-- Indexes
CREATE INDEX IF NOT EXISTS "RefundRequest_projectId_idx" ON "RefundRequest"("projectId");
CREATE INDEX IF NOT EXISTS "RefundRequest_userId_idx"    ON "RefundRequest"("userId");
CREATE INDEX IF NOT EXISTS "RefundRequest_status_idx"    ON "RefundRequest"("status");

-- Foreign keys
ALTER TABLE "RefundRequest"
  ADD CONSTRAINT IF NOT EXISTS "RefundRequest_pledgeId_fkey"
    FOREIGN KEY ("pledgeId") REFERENCES "Pledge"("id") ON DELETE CASCADE,
  ADD CONSTRAINT IF NOT EXISTS "RefundRequest_userId_fkey"
    FOREIGN KEY ("userId")   REFERENCES "User"("id")   ON DELETE CASCADE,
  ADD CONSTRAINT IF NOT EXISTS "RefundRequest_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;

-- Add campaign type support
DO $$ BEGIN
  CREATE TYPE "CampaignType" AS ENUM ('ALL_OR_NOTHING', 'KEEP_IT_ALL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "campaignType" "CampaignType" NOT NULL DEFAULT 'ALL_OR_NOTHING';
