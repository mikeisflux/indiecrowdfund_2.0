-- Records which version of the Terms of Service each creator accepted.
--
-- Idempotent: safe to run more than once. Creates nothing if it already exists.
CREATE TABLE IF NOT EXISTS "TermsAcceptance" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "version"    TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TermsAcceptance_userId_version_key"
    ON "TermsAcceptance" ("userId", "version");

CREATE INDEX IF NOT EXISTS "TermsAcceptance_userId_idx"
    ON "TermsAcceptance" ("userId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TermsAcceptance_userId_fkey'
    ) THEN
        ALTER TABLE "TermsAcceptance"
            ADD CONSTRAINT "TermsAcceptance_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
