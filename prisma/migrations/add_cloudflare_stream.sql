-- Phase 3 (Cloudflare flavor): Cloudflare Stream credentials on
-- PlatformSettings. Fully additive — runs cleanly on top of the
-- earlier add_rtmp_streams.sql migration.

ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "cloudflareStreamEnabled" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "cloudflareAccountId" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "cloudflareStreamApiToken" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "cloudflareStreamWebhookSecret" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "cloudflareCustomerId" TEXT;

-- The earlier rtmpServerEnabled / rtmpIngestUrlTemplate /
-- rtmpPlaybackUrlTemplate / rtmpWebhookSecret columns from
-- add_rtmp_streams.sql remain in the database but are no longer
-- referenced by any code. Safe to drop in a future cleanup migration.
