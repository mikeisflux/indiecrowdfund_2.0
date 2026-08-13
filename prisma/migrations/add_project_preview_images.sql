-- Interior preview pages for the campaign-page reader (layout v2).
--
-- Ordered list of image URLs, chosen by the creator in the campaign builder.
-- Not a PDF: a public page can only render a PDF the browser can fetch, which
-- would make the source file downloadable in full. Creator-selected images
-- mean nothing is public that wasn't meant to be.
--
-- Idempotent — safe to re-run.

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "previewImages" TEXT[] NOT NULL DEFAULT '{}';
