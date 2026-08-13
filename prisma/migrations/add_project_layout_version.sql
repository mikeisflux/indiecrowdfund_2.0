-- Campaign page layout version.
--
--   1 = original three-column layout (reward-category rail / story 50% / tier rail)
--   2 = story full width, rewards as a grid beneath it, sticky funding bar
--
-- The rule is "campaigns that had not gone live when v2 shipped keep v2
-- forever; anything already live or ended stays on v1". That has to be a
-- stamped column, not a derived check: deriving it from launchedAt would flip
-- a v2 campaign back to v1 the instant it launched.
--
-- The column defaults to 2 so every new project gets the new layout, then the
-- backfill pins everything that has ever launched to 1. Drafts, submitted,
-- approved and prelaunch projects keep the default and carry it through launch.
--
-- Idempotent — safe to re-run. The backfill is guarded so a second run can't
-- demote v2 projects that have since gone live.

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "layoutVersion" INTEGER NOT NULL DEFAULT 2;

DO $$
BEGIN
  -- Only run the backfill once. After the first pass, projects that launched
  -- on v2 must keep v2, so re-running must not touch them.
  IF NOT EXISTS (SELECT 1 FROM "Project" WHERE "layoutVersion" = 1) THEN
    UPDATE "Project"
       SET "layoutVersion" = 1
     WHERE "launchedAt" IS NOT NULL;
  END IF;
END
$$;
