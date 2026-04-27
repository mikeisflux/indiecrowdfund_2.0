-- Add Maverick Payments fields to PlatformSettings + MAVERICK to PaymentProcessor enum.
-- Idempotent: safe to re-run.

-- 1. PlatformSettings columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'maverickEnabled'
  ) THEN
    ALTER TABLE "PlatformSettings" ADD COLUMN "maverickEnabled" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'maverickApiToken'
  ) THEN
    ALTER TABLE "PlatformSettings" ADD COLUMN "maverickApiToken" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'maverickWebhookSecret'
  ) THEN
    ALTER TABLE "PlatformSettings" ADD COLUMN "maverickWebhookSecret" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'maverickDbaId'
  ) THEN
    ALTER TABLE "PlatformSettings" ADD COLUMN "maverickDbaId" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'maverickTerminalId'
  ) THEN
    ALTER TABLE "PlatformSettings" ADD COLUMN "maverickTerminalId" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'maverickEnvironment'
  ) THEN
    ALTER TABLE "PlatformSettings" ADD COLUMN "maverickEnvironment" TEXT NOT NULL DEFAULT 'production';
  END IF;
END$$;

-- 2. PaymentProcessor enum value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PaymentProcessor')
      AND enumlabel = 'MAVERICK'
  ) THEN
    ALTER TYPE "PaymentProcessor" ADD VALUE 'MAVERICK';
  END IF;
END$$;
