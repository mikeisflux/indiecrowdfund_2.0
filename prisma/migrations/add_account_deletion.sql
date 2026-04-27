-- User-initiated permanent account deletion. Distinct from `deletedAt`
-- (moderator-initiated soft delete). When `accountDeletedAt` is set,
-- the auth flow rejects login, the user's PII has been wiped, and any
-- pledge addresses/quantities have been anonymized — see
-- /api/user/delete-account for the full deletion routine.
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'accountDeletedAt'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "accountDeletedAt" TIMESTAMP(3);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "User_accountDeletedAt_idx"
  ON "User"("accountDeletedAt");
