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
