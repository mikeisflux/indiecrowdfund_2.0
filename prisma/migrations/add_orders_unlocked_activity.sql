-- Add ORDERS_UNLOCKED to the ActivityType enum.
--
-- Needed by POST /api/projects/[id]/survey/unlock, which reverses a survey
-- lock. Locking a survey blocks every backer submission, including from
-- backers who never responded at all, and until now there was no way back.
--
-- Safety: ADD VALUE on an enum is a catalog-only change. No table rewrite, no
-- scan, no ACCESS EXCLUSIVE lock on FulfillmentActivity — it is safe to run
-- against the live database while the app is serving.
--
-- Ordering: run this BEFORE deploying the code that writes the value.
-- Postgres will reject an INSERT naming an enum label that does not exist yet,
-- so a build-first deploy would 500 the unlock route until this lands.
--
-- ADD VALUE cannot run inside a transaction block on PostgreSQL < 12, and on
-- 12+ the new label is unusable until the transaction commits. This file is
-- deliberately a single statement outside any BEGIN/COMMIT so it works either
-- way; do not wrap it.

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'ORDERS_UNLOCKED';
