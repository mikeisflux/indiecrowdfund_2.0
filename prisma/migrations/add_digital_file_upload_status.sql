-- Digital file uploads used to create the DigitalFile row at multipart init
-- with nothing marking it unfinished. A refresh mid-upload left a row that
-- looked uploaded (and could be distributed) with no object behind it.
-- Track the upload, persist accepted parts so it can resume, and hide
-- unfinished rows from backers.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DigitalUploadStatus') THEN
    CREATE TYPE "DigitalUploadStatus" AS ENUM ('UPLOADING', 'READY', 'FAILED');
  END IF;
END
$$;
-- Default READY: every row that exists today went through a path that only
-- creates the row once the bytes are in R2 (single PUT) or was completed.
ALTER TABLE "DigitalFile" ADD COLUMN IF NOT EXISTS "uploadStatus" "DigitalUploadStatus" NOT NULL DEFAULT 'READY';
ALTER TABLE "DigitalFile" ADD COLUMN IF NOT EXISTS "multipartUploadId" TEXT;
ALTER TABLE "DigitalFile" ADD COLUMN IF NOT EXISTS "uploadedParts" JSONB;
ALTER TABLE "DigitalFile" ADD COLUMN IF NOT EXISTS "uploadedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "DigitalFile_uploadStatus_idx" ON "DigitalFile"("uploadStatus");
