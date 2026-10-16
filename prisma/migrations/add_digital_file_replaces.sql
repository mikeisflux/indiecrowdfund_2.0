-- Replacement uploads go through the chunked multipart path too. The
-- temporary row carrying the new bytes points at the file it will replace.
ALTER TABLE "DigitalFile" ADD COLUMN IF NOT EXISTS "replacesFileId" TEXT;
