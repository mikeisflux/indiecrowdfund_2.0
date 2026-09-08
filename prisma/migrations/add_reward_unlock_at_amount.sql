-- Goal-locked rewards: a reward that is listed from day one but cannot be
-- pledged until the campaign has raised a set amount.
--
-- Safe to run against a live database. The column is nullable with no default,
-- so Postgres rewrites nothing -- it is a catalog-only change that takes an
-- ACCESS EXCLUSIVE lock for the duration of a catalog update and no longer.
-- NULL means "available immediately", which is correct for every existing row,
-- so there is no backfill.
--
-- Re-runnable: IF NOT EXISTS, so a partial deploy can be replayed.

BEGIN;

-- Don't queue behind a long-running transaction and block every reward read
-- while we wait. Better to fail fast and retry than to stall checkout.
SET LOCAL lock_timeout = '5s';

ALTER TABLE "Reward"
  ADD COLUMN IF NOT EXISTS "unlockAtAmount" DECIMAL(10, 2);

COMMIT;
