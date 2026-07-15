-- Printing Comics hard proofing: per-order proof state synced from the
-- printer's proof webhook, plus the tokenized review link we surface to
-- the creator.
ALTER TABLE "ProjectPrintOrder" ADD COLUMN IF NOT EXISTS "proofStatus" TEXT;
ALTER TABLE "ProjectPrintOrder" ADD COLUMN IF NOT EXISTS "proofUrl" TEXT;
ALTER TABLE "ProjectPrintOrder" ADD COLUMN IF NOT EXISTS "proofReviewUrl" TEXT;
ALTER TABLE "ProjectPrintOrder" ADD COLUMN IF NOT EXISTS "proofVersion" INTEGER;
ALTER TABLE "ProjectPrintOrder" ADD COLUMN IF NOT EXISTS "proofUpdatedAt" TIMESTAMP(3);
