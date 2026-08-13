-- Reward.category — creator-chosen grouping label for the campaign-page
-- filter pills ("Covers", "Box Sets", "Upgrades"). Free text, nullable;
-- existing rewards come out uncategorised, which the campaign page renders
-- under "Other".
--
-- Idempotent: safe to run more than once.

ALTER TABLE "Reward"
  ADD COLUMN IF NOT EXISTS "category" TEXT;

-- The campaign page reads every reward for a project and partitions in
-- memory, so this index is for the creator-facing "categories already used on
-- this project" lookup and for any future per-category query.
CREATE INDEX IF NOT EXISTS "Reward_projectId_category_idx"
  ON "Reward" ("projectId", "category");
