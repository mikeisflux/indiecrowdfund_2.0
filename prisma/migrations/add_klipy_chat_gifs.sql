-- Add Klipy GIF settings to PlatformSettings
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "klipyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "klipyApiKey" TEXT;

-- Add GIF to ChatMessageType enum (idempotent — safe to re-run)
DO $$ BEGIN
  ALTER TYPE "ChatMessageType" ADD VALUE IF NOT EXISTS 'GIF';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
