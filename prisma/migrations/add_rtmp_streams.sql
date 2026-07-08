-- Phase 3: RTMP launch parties on per-creator chat rooms.
-- Idempotent — safe to re-run.

-- ChatRoom: per-session identifier + cached viewer count.
ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "liveSessionId" TEXT;
ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "viewerCount" INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE "ChatRoom"
    ADD CONSTRAINT "ChatRoom_liveSessionId_key" UNIQUE ("liveSessionId");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- PlatformSettings: RTMP server config used by every creator room.
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "rtmpServerEnabled" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "rtmpIngestUrlTemplate" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "rtmpPlaybackUrlTemplate" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "rtmpWebhookSecret" TEXT;

-- New notification type for "creator just went live".
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LIVE_STREAM_STARTED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
