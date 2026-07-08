-- Add NMI (Network Merchants) Payments fields to PlatformSettings + NMI value
-- to PaymentProcessor enum. Idempotent: safe to re-run.

-- 1. PlatformSettings columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'nmiEnabled'
  ) THEN
    ALTER TABLE "PlatformSettings" ADD COLUMN "nmiEnabled" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'nmiSecurityKey'
  ) THEN
    ALTER TABLE "PlatformSettings" ADD COLUMN "nmiSecurityKey" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'nmiPublicKey'
  ) THEN
    ALTER TABLE "PlatformSettings" ADD COLUMN "nmiPublicKey" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'nmiWebhookSecret'
  ) THEN
    ALTER TABLE "PlatformSettings" ADD COLUMN "nmiWebhookSecret" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'nmiEnvironment'
  ) THEN
    ALTER TABLE "PlatformSettings" ADD COLUMN "nmiEnvironment" TEXT NOT NULL DEFAULT 'production';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'nmiGatewayUrlOverride'
  ) THEN
    ALTER TABLE "PlatformSettings" ADD COLUMN "nmiGatewayUrlOverride" TEXT;
  END IF;
END$$;

-- 2. PaymentProcessor enum value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PaymentProcessor')
      AND enumlabel = 'NMI'
  ) THEN
    ALTER TYPE "PaymentProcessor" ADD VALUE 'NMI';
  END IF;
END$$;
