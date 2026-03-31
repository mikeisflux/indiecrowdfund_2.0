-- Migration: Add PayPal payment processor support
-- Run with: PGPASSWORD='01JSN9vhvVTiMEU7odCpF6L3' psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_paypal_support.sql

-- 1. Add PAYPAL to PaymentProcessor enum
ALTER TYPE "PaymentProcessor" ADD VALUE IF NOT EXISTS 'PAYPAL';

-- 2. Add paypalOrderId to Pledge
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "paypalOrderId" TEXT UNIQUE;

-- 3. Add PayPal settings to PlatformSettings
ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "paypalEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "paypalClientId" TEXT,
  ADD COLUMN IF NOT EXISTS "paypalClientSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "paypalWebhookId" TEXT,
  ADD COLUMN IF NOT EXISTS "paypalMode" TEXT NOT NULL DEFAULT 'live';

-- 4. Create PayPalPayoutStatus enum
DO $$ BEGIN
  CREATE TYPE "PayPalPayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 5. Create PayPalPayoutConfig table
CREATE TABLE IF NOT EXISTS "PayPalPayoutConfig" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "paypalEmail" TEXT NOT NULL,
  "isVerified"  BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayPalPayoutConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayPalPayoutConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PayPalPayoutConfig_userId_key" ON "PayPalPayoutConfig"("userId");
CREATE INDEX IF NOT EXISTS "PayPalPayoutConfig_userId_idx" ON "PayPalPayoutConfig"("userId");

-- 6. Create PayPalPayout table
CREATE TABLE IF NOT EXISTS "PayPalPayout" (
  "id"              TEXT NOT NULL,
  "payoutConfigId"  TEXT NOT NULL,
  "projectId"       TEXT,
  "projectName"     TEXT,
  "grossAmount"     DECIMAL(10,2) NOT NULL,
  "platformFee"     DECIMAL(10,2) NOT NULL,
  "netAmount"       DECIMAL(10,2) NOT NULL,
  "currency"        TEXT NOT NULL DEFAULT 'USD',
  "paypalBatchId"   TEXT,
  "paypalItemId"    TEXT,
  "status"          "PayPalPayoutStatus" NOT NULL DEFAULT 'PENDING',
  "initiatedAt"     TIMESTAMP(3),
  "completedAt"     TIMESTAMP(3),
  "failedAt"        TIMESTAMP(3),
  "failureReason"   TEXT,
  "adminNotes"      TEXT,
  "processedBy"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayPalPayout_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayPalPayout_payoutConfigId_fkey" FOREIGN KEY ("payoutConfigId") REFERENCES "PayPalPayoutConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PayPalPayout_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PayPalPayout_payoutConfigId_idx" ON "PayPalPayout"("payoutConfigId");
CREATE INDEX IF NOT EXISTS "PayPalPayout_projectId_idx" ON "PayPalPayout"("projectId");
CREATE INDEX IF NOT EXISTS "PayPalPayout_status_idx" ON "PayPalPayout"("status");

-- 7. Add paypalOrderId to MarketplacePurchase
ALTER TABLE "MarketplacePurchase" ADD COLUMN IF NOT EXISTS "paypalOrderId" TEXT UNIQUE;
