-- Interior preview for the campaign-page reader (layout v2).
--
-- A single PDF, uploaded by the creator and rasterised client-side by pdf.js
-- into the same page-turn reader the Digital Library uses. The file is served
-- publicly from /api/uploads, so the builder tells creators plainly that the
-- PDF they upload must be the preview itself — the pages they're happy to
-- publish — not the finished book.
--
-- Supersedes the never-deployed "previewImages" text array. That column is
-- dropped only when it exists and holds nothing, so this cannot destroy data
-- on an environment where the earlier migration was applied and used.
--
-- Idempotent — safe to re-run.

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "previewPdfUrl" TEXT;

DO $$
DECLARE
  populated BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Project' AND column_name = 'previewImages'
  ) THEN
    EXECUTE 'SELECT count(*) FROM "Project" WHERE array_length("previewImages", 1) > 0'
      INTO populated;

    IF populated = 0 THEN
      ALTER TABLE "Project" DROP COLUMN "previewImages";
      RAISE NOTICE 'Dropped empty previewImages column.';
    ELSE
      RAISE NOTICE 'Kept previewImages: % project(s) still have pages in it.', populated;
    END IF;
  END IF;
END $$;
