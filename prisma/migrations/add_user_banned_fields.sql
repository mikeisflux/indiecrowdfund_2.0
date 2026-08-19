-- Separate "banned" from "locked" on User.
--
-- The public BANNED stamp on campaign pages was derived from lockedAt. Both
-- LOCK_ACCOUNT and BAN_USER set lockedAt, so putting a creator on a routine
-- administrative hold published an accusation of being banned across every one
-- of their campaigns. bannedAt is the narrower flag and the only one anything
-- user-facing is allowed to read.
--
-- Run on the production server (auth via ~/.pgpass — never put the password here):
--   psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_user_banned_fields.sql

-- Safe on a live site: the three columns are nullable with no default, which
-- Postgres 11+ applies as a catalog update rather than a table rewrite, and
-- the index is built CONCURRENTLY so User stays writable (sign-ins and
-- registrations keep working). lock_timeout stops a statement that cannot get
-- its lock from queueing and blocking every other write behind it.
--
-- Not wrapped in a transaction: CREATE INDEX CONCURRENTLY cannot run inside
-- one. Every statement is independently re-runnable.
SET lock_timeout = '3s';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedAt"     TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedById"   TEXT;

SET lock_timeout = 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_bannedAt_idx" ON "User"("bannedAt");
SET lock_timeout = '3s';

-- Backfill. Every ban the platform issues writes a reason containing "ban":
--   BAN_USER default ............ 'Account banned by administrator'
--   chargeback cron ............. 'Auto-banned: matches banned account ...'
--   DC pre-charge prefilter ..... 'Auto-banned: DC pre-charge prefilter ...'
-- while a plain lock defaults to 'Account locked by administrator'.
--
-- Deliberately biased toward UNDER-marking: a real ban that was recorded with a
-- custom reason not containing "ban" stays locked-only, which means the account
-- is still barred from signing in but no public accusation is made until an
-- admin re-bans it. The opposite error — marking a merely-locked creator as
-- banned — is the bug this migration exists to fix, so it must not be
-- reintroduced by a greedy backfill.
-- Touches only rows that are already locked; cannot affect pledges, campaigns
-- or payouts. Fully reversible by dropping the three columns.
UPDATE "User"
SET "bannedAt"     = "lockedAt",
    "bannedReason" = "lockedReason",
    "bannedById"   = "lockedById"
WHERE "lockedAt" IS NOT NULL
  AND "bannedAt" IS NULL
  AND "lockedReason" ILIKE '%ban%';

-- Review afterwards: anything still locked but not banned. Confirm each is a
-- hold rather than a ban, and re-ban from the admin UI if it should be one.
--   SELECT id, email, "lockedAt", "lockedReason"
--   FROM "User"
--   WHERE "lockedAt" IS NOT NULL AND "bannedAt" IS NULL AND "deletedAt" IS NULL
--   ORDER BY "lockedAt" DESC;
