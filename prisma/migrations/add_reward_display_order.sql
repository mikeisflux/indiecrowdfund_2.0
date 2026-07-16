-- Creator-chosen display order for reward tiers / add-ons. Null = not
-- manually ordered (fall back to price). Ordered within each type.
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER;

-- Helps the ordered reads (displayOrder asc nulls last, then amount).
CREATE INDEX IF NOT EXISTS "Reward_projectId_type_displayOrder_idx"
  ON "Reward" ("projectId", "type", "displayOrder");
