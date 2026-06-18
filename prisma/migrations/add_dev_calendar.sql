-- Dev Calendar table + enums.
-- Idempotent: safe to run twice (uses IF NOT EXISTS / DO blocks).

DO $$ BEGIN
  CREATE TYPE "DevCalendarEntryType" AS ENUM ('NOTE', 'REMINDER', 'JOB_SCHEDULE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DevCalendarEntryStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "DevCalendarEntry" (
  "id"             TEXT PRIMARY KEY,
  "type"           "DevCalendarEntryType" NOT NULL DEFAULT 'NOTE',
  "title"          TEXT NOT NULL,
  "description"    TEXT,
  "scheduledFor"   TIMESTAMP(3),
  "cronExpression" TEXT,
  "link"           TEXT,
  "status"         "DevCalendarEntryStatus" NOT NULL DEFAULT 'PENDING',
  "tags"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdById"    TEXT,
  "completedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "DevCalendarEntry_scheduledFor_idx" ON "DevCalendarEntry" ("scheduledFor");
CREATE INDEX IF NOT EXISTS "DevCalendarEntry_status_idx"       ON "DevCalendarEntry" ("status");
CREATE INDEX IF NOT EXISTS "DevCalendarEntry_type_idx"         ON "DevCalendarEntry" ("type");

-- Apply on prod:
--   PGPASSWORD='...' psql -h localhost -U indieuser -d indiecrowdfund \
--     -f prisma/migrations/add_dev_calendar.sql
