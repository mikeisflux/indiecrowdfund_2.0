-- Per-creator branded chat rooms with optional RTMP launch-party support.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "ChatRoom" (
  "id"                   TEXT PRIMARY KEY,
  "name"                 TEXT NOT NULL,
  "slug"                 TEXT NOT NULL UNIQUE,
  "ownerUserId"          TEXT NOT NULL,
  "ownerUserIds"         TEXT[] NOT NULL DEFAULT '{}',
  "rtmpEnabled"          BOOLEAN NOT NULL DEFAULT FALSE,
  "rtmpStreamKey"        TEXT UNIQUE,
  "rtmpIngestUrl"        TEXT,
  "rtmpPlaybackUrl"      TEXT,
  "liveStreamStartedAt"  TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ChatRoom_ownerUserId_idx" ON "ChatRoom"("ownerUserId");

ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "roomId" TEXT;
DO $$ BEGIN
  ALTER TABLE "ChatMessage"
    ADD CONSTRAINT "ChatMessage_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");

ALTER TABLE "ChatPresence" ADD COLUMN IF NOT EXISTS "roomId" TEXT;
DO $$ BEGIN
  ALTER TABLE "ChatPresence"
    ADD CONSTRAINT "ChatPresence_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "ChatPresence_roomId_lastActiveAt_idx" ON "ChatPresence"("roomId", "lastActiveAt");

-- ChatPresence used to be unique on userId alone; widen to (userId, roomId)
-- so the same user can be present in both the global chat and a creator
-- room. Drop the old constraint if it exists.
DO $$ BEGIN
  ALTER TABLE "ChatPresence" DROP CONSTRAINT "ChatPresence_userId_key";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ChatPresence"
    ADD CONSTRAINT "ChatPresence_userId_roomId_key" UNIQUE ("userId", "roomId");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Persistent room membership.
CREATE TABLE IF NOT EXISTS "ChatRoomMember" (
  "id"                   TEXT PRIMARY KEY,
  "roomId"               TEXT NOT NULL,
  "userId"               TEXT NOT NULL,
  "notificationsEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "joinedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReadAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "ChatRoomMember"
    ADD CONSTRAINT "ChatRoomMember_roomId_userId_key" UNIQUE ("roomId", "userId");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChatRoomMember"
    ADD CONSTRAINT "ChatRoomMember_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChatRoomMember"
    ADD CONSTRAINT "ChatRoomMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ChatRoomMember_userId_idx" ON "ChatRoomMember"("userId");

-- Allow new-message notifications to use the existing Notification table.
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CHAT_MESSAGE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- One-time data migration: hand the existing global chat to the Divinity
-- Comics users (mikeisflux@indiecrowdfund.com + divinitycomicsinc@gmail.com).
-- Idempotent — only runs if both users exist and the room hasn't been
-- created yet. Re-points all roomId-NULL ChatMessage and ChatPresence
-- rows to the new room.
DO $$
DECLARE
  divinity_user_ids TEXT[];
  primary_owner TEXT;
  new_room_id TEXT;
BEGIN
  SELECT array_agg(id ORDER BY (email = 'mikeisflux@indiecrowdfund.com') DESC) INTO divinity_user_ids
  FROM "User"
  WHERE email IN ('divinitycomicsinc@gmail.com', 'mikeisflux@indiecrowdfund.com')
    AND "deletedAt" IS NULL;

  IF array_length(divinity_user_ids, 1) IS NULL THEN
    RAISE NOTICE 'Skipping divinity merge — no matching users found';
    RETURN;
  END IF;

  primary_owner := divinity_user_ids[1];

  SELECT id INTO new_room_id FROM "ChatRoom" WHERE slug = 'divinity-comics' LIMIT 1;
  IF new_room_id IS NULL THEN
    new_room_id := 'cm' || substr(md5(random()::text || clock_timestamp()::text), 1, 22);
    INSERT INTO "ChatRoom" (id, name, slug, "ownerUserId", "ownerUserIds", "createdAt", "updatedAt")
    VALUES (
      new_room_id,
      'Divinity Comics''s Chat',
      'divinity-comics',
      primary_owner,
      divinity_user_ids,
      NOW(), NOW()
    );
    RAISE NOTICE 'Created Divinity Comics chat room %', new_room_id;
  END IF;

  -- Migrate the legacy global feed into this room. Anything still
  -- roomId-NULL after this stays a "global" message, but in practice
  -- this catches everything that existed before per-creator rooms.
  UPDATE "ChatMessage" SET "roomId" = new_room_id WHERE "roomId" IS NULL;
  UPDATE "ChatPresence" SET "roomId" = new_room_id WHERE "roomId" IS NULL;
END $$;
