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

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedAt"     TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedById"   TEXT;

CREATE INDEX IF NOT EXISTS "User_bannedAt_idx" ON "User"("bannedAt");

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
