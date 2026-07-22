-- Migration: Add Whop payment processor support
-- Run with (auth via ~/.pgpass — never put the password here): psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_whop_payment_processor.sql

-- Add Whop fields to PlatformSettings
ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "whopEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "whopApiKey" TEXT,
  ADD COLUMN IF NOT EXISTS "whopPlanId" TEXT,
  ADD COLUMN IF NOT EXISTS "whopCompanyId" TEXT,
  ADD COLUMN IF NOT EXISTS "whopWebhookSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "whopEnvironment" TEXT NOT NULL DEFAULT 'production';

-- Add WHOP to PaymentProcessor enum
ALTER TYPE "PaymentProcessor" ADD VALUE IF NOT EXISTS 'WHOP';

-- Add whopCheckoutId to Pledge
ALTER TABLE "Pledge"
  ADD COLUMN IF NOT EXISTS "whopCheckoutId" TEXT UNIQUE;

-- Add WhopBankAccount table
CREATE TABLE IF NOT EXISTS "WhopBankAccount" (
  "id"                    TEXT NOT NULL,
  "userId"                TEXT NOT NULL,
  "bankNameEncrypted"     TEXT NOT NULL,
  "accountHolderEncrypted" TEXT NOT NULL,
  "accountNumberEncrypted" TEXT NOT NULL,
  "routingNumberEncrypted" TEXT NOT NULL,
  "bankNameDisplay"       TEXT,
  "accountLastFour"       TEXT,
  "accountType"           TEXT NOT NULL DEFAULT 'checking',
  "isVerified"            BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt"            TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhopBankAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WhopBankAccount_userId_key" ON "WhopBankAccount"("userId");
CREATE INDEX IF NOT EXISTS "WhopBankAccount_userId_idx" ON "WhopBankAccount"("userId");
ALTER TABLE "WhopBankAccount" ADD CONSTRAINT "WhopBankAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add WhopSettlementStatus enum
DO $$ BEGIN
  CREATE TYPE "WhopSettlementStatus" AS ENUM ('PENDING','INITIATED','PROCESSING','COMPLETED','FAILED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add WhopSettlement table
CREATE TABLE IF NOT EXISTS "WhopSettlement" (
  "id"            TEXT NOT NULL,
  "bankAccountId" TEXT NOT NULL,
  "projectId"     TEXT,
  "projectName"   TEXT,
  "amount"        DECIMAL(10,2) NOT NULL,
  "currency"      TEXT NOT NULL DEFAULT 'USD',
  "status"        "WhopSettlementStatus" NOT NULL DEFAULT 'PENDING',
  "initiatedAt"   TIMESTAMP(3),
  "processedAt"   TIMESTAMP(3),
  "completedAt"   TIMESTAMP(3),
  "failedAt"      TIMESTAMP(3),
  "failureReason" TEXT,
  "adminNotes"    TEXT,
  "processedBy"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhopSettlement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WhopSettlement_bankAccountId_idx" ON "WhopSettlement"("bankAccountId");
CREATE INDEX IF NOT EXISTS "WhopSettlement_projectId_idx" ON "WhopSettlement"("projectId");
CREATE INDEX IF NOT EXISTS "WhopSettlement_status_idx" ON "WhopSettlement"("status");
ALTER TABLE "WhopSettlement" ADD CONSTRAINT "WhopSettlement_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "WhopBankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhopSettlement" ADD CONSTRAINT "WhopSettlement_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
