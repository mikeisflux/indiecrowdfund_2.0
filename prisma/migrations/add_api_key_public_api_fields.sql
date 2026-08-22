-- Public Data API (v1): give ApiKey an owner, a secret half, and caller identity.
--
-- Safety: every column is nullable or has a default, so this is a catalog-only
-- change on PostgreSQL — no table rewrite and no scan of existing rows. The
-- index is created CONCURRENTLY so it never takes a write lock on ApiKey.
--
-- Existing admin-minted keys keep working. They get userId = NULL, which the
-- auth path treats as a legacy key rather than rejecting: revoking them
-- retroactively would break whatever is already calling with them.
--
-- Run before deploying the code. The app reads these columns on every
-- authenticated API request.

SET lock_timeout = '5s';

ALTER TABLE "ApiKey"
  ADD COLUMN IF NOT EXISTS "userId"       TEXT,
  ADD COLUMN IF NOT EXISTS "secretHash"   TEXT,
  ADD COLUMN IF NOT EXISTS "secretPrefix" TEXT,
  ADD COLUMN IF NOT EXISTS "appName"      TEXT,
  ADD COLUMN IF NOT EXISTS "appUrl"       TEXT,
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "scopes"       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "lastUsedIp"   TEXT,
  ADD COLUMN IF NOT EXISTS "revokedById"  TEXT;

RESET lock_timeout;

-- CONCURRENTLY cannot run inside a transaction block. Kept as its own
-- statement so psql autocommits it.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey" ("userId");

-- NOT VALID skips the full-table check of existing rows, so adding the foreign
-- key does not block writes. Existing rows all have userId = NULL and satisfy
-- it trivially; validate off-peak with:
--   ALTER TABLE "ApiKey" VALIDATE CONSTRAINT "ApiKey_userId_fkey";
ALTER TABLE "ApiKey"
  ADD CONSTRAINT "ApiKey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
  NOT VALID;
