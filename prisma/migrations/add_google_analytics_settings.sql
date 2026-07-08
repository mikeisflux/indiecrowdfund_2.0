-- Add Google Analytics / Tag Manager settings to PlatformSettings
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "gaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "googleAnalyticsId" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "gtmEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "googleTagManagerId" TEXT;
