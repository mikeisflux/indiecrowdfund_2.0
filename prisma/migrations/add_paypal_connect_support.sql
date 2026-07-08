-- Migration: Add PayPal Connect (Complete Payments Platform / multiparty marketplace) support
-- Run with: PGPASSWORD='...' psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_paypal_connect_support.sql
--
-- Additive and isolated from the existing PayPal integration. Nothing here
-- alters standard PayPal columns, the standard PayPal webhook, or its settings.

-- 1. Add PAYPAL_CONNECT to the PaymentProcessor enum
ALTER TYPE "PaymentProcessor" ADD VALUE IF NOT EXISTS 'PAYPAL_CONNECT';

-- 2. Add PayPal Connect id columns to Pledge (separate from paypalOrderId etc.)
ALTER TABLE "Pledge"
  ADD COLUMN IF NOT EXISTS "paypalConnectOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "paypalConnectCaptureId" TEXT,
  ADD COLUMN IF NOT EXISTS "paypalConnectAuthorizationId" TEXT,
  ADD COLUMN IF NOT EXISTS "paypalConnectSellerMerchantId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Pledge_paypalConnectOrderId_key" ON "Pledge"("paypalConnectOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "Pledge_paypalConnectCaptureId_key" ON "Pledge"("paypalConnectCaptureId");
CREATE UNIQUE INDEX IF NOT EXISTS "Pledge_paypalConnectAuthorizationId_key" ON "Pledge"("paypalConnectAuthorizationId");

-- 3. Add PayPal Connect platform settings (separate PPCP partner app credentials)
ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "paypalConnectEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "paypalConnectClientId" TEXT,
  ADD COLUMN IF NOT EXISTS "paypalConnectClientSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "paypalConnectBnCode" TEXT,
  ADD COLUMN IF NOT EXISTS "paypalConnectPartnerMerchantId" TEXT,
  ADD COLUMN IF NOT EXISTS "paypalConnectWebhookId" TEXT,
  ADD COLUMN IF NOT EXISTS "paypalConnectMode" TEXT NOT NULL DEFAULT 'live';

-- 4. Create PayPalConnectOnboardingStatus enum
DO $$ BEGIN
  CREATE TYPE "PayPalConnectOnboardingStatus" AS ENUM ('NOT_STARTED','STARTED','PENDING','COMPLETED','REVOKED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 5. Create PayPalConnectAccount table (per-creator onboarding record)
CREATE TABLE IF NOT EXISTS "PayPalConnectAccount" (
  "id"                 TEXT NOT NULL,
  "userId"             TEXT NOT NULL,
  "merchantIdInPayPal" TEXT,
  "trackingId"         TEXT,
  "referralSelfLink"   TEXT,
  "onboardingStatus"   "PayPalConnectOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "paymentsReceivable" BOOLEAN NOT NULL DEFAULT false,
  "emailConfirmed"     BOOLEAN NOT NULL DEFAULT false,
  "scopesGranted"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isLive"             BOOLEAN NOT NULL DEFAULT false,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayPalConnectAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayPalConnectAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PayPalConnectAccount_userId_key" ON "PayPalConnectAccount"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "PayPalConnectAccount_merchantIdInPayPal_key" ON "PayPalConnectAccount"("merchantIdInPayPal");
CREATE INDEX IF NOT EXISTS "PayPalConnectAccount_userId_idx" ON "PayPalConnectAccount"("userId");
CREATE INDEX IF NOT EXISTS "PayPalConnectAccount_merchantIdInPayPal_idx" ON "PayPalConnectAccount"("merchantIdInPayPal");
