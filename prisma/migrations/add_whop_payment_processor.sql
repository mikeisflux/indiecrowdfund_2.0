-- Migration: Add Whop payment processor support
-- Run with: PGPASSWORD='01JSN9vhvVTiMEU7odCpF6L3' psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_whop_payment_processor.sql

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
