-- Grant Program: creator's signed acceptance of the grant agreement per project.
-- Run on the production server:
--   PGPASSWORD='AH2hqkufqtrp9BmdRkAsdU83N9fW4Q6w' psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_grant_agreement.sql
CREATE TABLE IF NOT EXISTS "GrantAgreement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrantAgreement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GrantAgreement_projectId_key" ON "GrantAgreement"("projectId");
CREATE INDEX IF NOT EXISTS "GrantAgreement_userId_idx" ON "GrantAgreement"("userId");
DO $$ BEGIN
  ALTER TABLE "GrantAgreement" ADD CONSTRAINT "GrantAgreement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "GrantAgreement" ADD CONSTRAINT "GrantAgreement_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tax information collected at signing time (added with the admin payouts
-- agreement tooling). Guarded so this file stays safe to re-run whether or
-- not the table was created before these columns existed.
ALTER TABLE "GrantAgreement" ADD COLUMN IF NOT EXISTS "taxLegalName" TEXT;
ALTER TABLE "GrantAgreement" ADD COLUMN IF NOT EXISTS "taxBusinessName" TEXT;
ALTER TABLE "GrantAgreement" ADD COLUMN IF NOT EXISTS "taxEntityType" TEXT;
ALTER TABLE "GrantAgreement" ADD COLUMN IF NOT EXISTS "taxIdEncrypted" TEXT;
ALTER TABLE "GrantAgreement" ADD COLUMN IF NOT EXISTS "taxIdLast4" TEXT;
ALTER TABLE "GrantAgreement" ADD COLUMN IF NOT EXISTS "taxAddressLine1" TEXT;
ALTER TABLE "GrantAgreement" ADD COLUMN IF NOT EXISTS "taxAddressLine2" TEXT;
ALTER TABLE "GrantAgreement" ADD COLUMN IF NOT EXISTS "taxCity" TEXT;
ALTER TABLE "GrantAgreement" ADD COLUMN IF NOT EXISTS "taxState" TEXT;
ALTER TABLE "GrantAgreement" ADD COLUMN IF NOT EXISTS "taxZip" TEXT;
ALTER TABLE "GrantAgreement" ADD COLUMN IF NOT EXISTS "taxCountry" TEXT;
