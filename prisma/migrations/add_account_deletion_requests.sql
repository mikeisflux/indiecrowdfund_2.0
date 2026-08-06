-- Account deletion approval queue.
--
-- Creators who have ever taken a campaign live cannot self-delete: deletion
-- releases them from fulfillment obligations to backers, so an admin
-- reviews first. Backers and creators who never launched still delete
-- instantly and never create a row here.
--
-- Idempotent — safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountDeletionRequestStatus') THEN
    CREATE TYPE "AccountDeletionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "AccountDeletionRequest" (
  "id"                    TEXT NOT NULL,
  "userId"                TEXT NOT NULL,
  "status"                "AccountDeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "launchedProjectCount"  INTEGER NOT NULL DEFAULT 0,
  "unfulfilledCount"      INTEGER NOT NULL DEFAULT 0,
  "fulfilledCount"        INTEGER NOT NULL DEFAULT 0,
  "snapshot"              JSONB,
  "acknowledgedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestIp"             TEXT,
  "requestUserAgent"      TEXT,
  "reviewedById"          TEXT,
  "reviewedAt"            TIMESTAMP(3),
  "reviewNotes"           TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccountDeletionRequest_userId_fkey'
  ) THEN
    ALTER TABLE "AccountDeletionRequest"
      ADD CONSTRAINT "AccountDeletionRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccountDeletionRequest_reviewedById_fkey'
  ) THEN
    ALTER TABLE "AccountDeletionRequest"
      ADD CONSTRAINT "AccountDeletionRequest_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_status_createdAt_idx"
  ON "AccountDeletionRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_userId_idx"
  ON "AccountDeletionRequest"("userId");

-- Eligibility filters on launchedAt to decide "has this creator ever gone
-- live", which runs on every open of the delete dialog.
CREATE INDEX IF NOT EXISTS "Project_creatorId_launchedAt_idx"
  ON "Project"("creatorId", "launchedAt");
