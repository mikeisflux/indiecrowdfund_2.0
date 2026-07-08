-- Rating-request nudge: dedup column + new EmailType value.
-- Idempotent; safe to run twice.

-- 1. Pledge.ratingRequestSentAt — dedup guard so the delivered
--    trigger, the backer-marked-received trigger, and the one-time
--    backlog send never double-email the same backer.
ALTER TABLE "Pledge"
  ADD COLUMN IF NOT EXISTS "ratingRequestSentAt" TIMESTAMP(3);

-- 2. EmailType.RATING_REQUEST enum value.
DO $$ BEGIN
  ALTER TYPE "EmailType" ADD VALUE IF NOT EXISTS 'RATING_REQUEST';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Apply on prod:
--   PGPASSWORD='...' psql -h localhost -U indieuser -d indiecrowdfund \
--     -f prisma/migrations/add_rating_request_tracking.sql
