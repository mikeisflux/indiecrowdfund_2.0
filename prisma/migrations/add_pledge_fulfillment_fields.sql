-- Make the fulfillment push routes runnable.
--
-- ShipStation, Shippo, EasyPost and Stamps all read and wrote
-- Pledge.externalOrderId and Pledge.trackingNumber, and all joined
-- Pledge -> SurveyResponse to get the shipping address. None of the three
-- existed in the schema, so Prisma rejected the query and every push failed
-- before it sent anything.
--
-- WRITTEN TO BE SAFE ON A LIVE SITE. Pledge is the money table and campaigns
-- are taking pledges while this runs, so nothing here holds a lock long
-- enough to block a backer:
--
--   * The two ADD COLUMNs are nullable with no default, which Postgres 11+
--     does as a catalog update — no table rewrite, no scan.
--   * The index is built CONCURRENTLY, so writes to Pledge continue.
--   * The foreign key is added NOT VALID, which skips the scan of existing
--     rows. It enforces correctness for everything written from now on. The
--     one-off check of old rows is a separate, optional step at the bottom
--     that can wait for a quiet hour.
--   * lock_timeout means a statement that cannot get its lock immediately
--     gives up instead of queueing and blocking every write behind it.
--
-- Because CREATE INDEX CONCURRENTLY cannot run inside a transaction block,
-- this file is deliberately NOT wrapped in BEGIN/COMMIT. Each statement
-- stands alone and is safe to re-run.
--
-- Run on the production server (auth via ~/.pgpass — never put the password here):
--   psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_pledge_fulfillment_fields.sql

SET lock_timeout = '3s';

-- 1. The two columns the push routes write. Catalog-only, effectively instant.
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "externalOrderId" TEXT;
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "trackingNumber"  TEXT;

-- 2. Tracking sync looks pledges up by externalOrderId, so it needs an index.
--    CONCURRENTLY keeps Pledge writable while it builds. It cannot run under
--    a lock_timeout, so that is lifted for this statement only.
SET lock_timeout = 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Pledge_externalOrderId_idx"
  ON "Pledge"("externalOrderId");
SET lock_timeout = '3s';

-- 3. The Pledge <-> SurveyResponse relation.
--
-- SurveyResponse.pledgeId already exists and is already UNIQUE, so the data
-- is 1:1 today; only the declaration was missing.
--
-- ON DELETE CASCADE matches what the application already does by hand — every
-- path that hard-deletes a pledge deletes its survey response first — so this
-- changes no behaviour, it just stops a future path from leaving an orphan.
-- It cannot make a delete fail; CASCADE only ever lets one succeed.
--
-- NOT VALID means existing rows are not scanned now. New and updated rows are
-- checked from this moment on.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SurveyResponse_pledgeId_fkey'
  ) THEN
    ALTER TABLE "SurveyResponse"
      ADD CONSTRAINT "SurveyResponse_pledgeId_fkey"
      FOREIGN KEY ("pledgeId") REFERENCES "Pledge"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
      NOT VALID;
  END IF;
END $$;

-- ── Optional follow-up, any quiet moment ────────────────────────────────────
--
-- Check whether any pre-existing SurveyResponse points at a pledge that is
-- gone. Read-only, safe to run any time:
--
--   SELECT COUNT(*) FROM "SurveyResponse" sr
--   LEFT JOIN "Pledge" p ON p.id = sr."pledgeId"
--   WHERE p.id IS NULL;
--
-- If that returns 0, mark the constraint validated. This takes a SHARE UPDATE
-- EXCLUSIVE lock — it does NOT block reads or writes, but it does scan the
-- table, so run it off-peak:
--
--   ALTER TABLE "SurveyResponse" VALIDATE CONSTRAINT "SurveyResponse_pledgeId_fkey";
--
-- If it returns more than 0, look at the rows before deleting anything — they
-- are survey answers whose pledge no longer exists.
--
-- ── Note on history ─────────────────────────────────────────────────────────
--
-- Orders pushed to a carrier before today were never recorded, because the
-- column to record them in did not exist. Those pledges will look un-pushed
-- and can be pushed again: the ShipStation order key is derived from the
-- pledge id, so a re-push updates the existing order rather than duplicating
-- it. Shippo, EasyPost and Stamps do not have that guarantee — check those
-- dashboards before bulk re-pushing on them.
