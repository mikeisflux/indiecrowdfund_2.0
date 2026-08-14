-- Backfill Reward.displayOrder so no reward is left unordered.
--
-- displayOrder was only written when a creator dragged a reward or picked a
-- sort in the builder. Everything else stayed NULL, and the public page orders
-- by `displayOrder asc nulls last, amount asc` — so an untouched reward fell
-- to the back of the grid sorted by price, regardless of where the builder
-- showed it. A campaign where nothing had ever been dragged rendered entirely
-- in price order, which is not an order anyone chose.
--
-- The backfill assigns each reward its CURRENT effective position, using the
-- exact ordering the app already reads. That means this migration changes
-- nothing visible: every campaign renders in the same order after it as
-- before. What it changes is the future — new rewards now append after a real
-- number instead of mixing with a pool of NULLs, so creation order is
-- preserved instead of collapsing to price.
--
-- Numbered within (projectId, type), because the page filters to TIER or ADDON
-- before ordering.
--
-- Idempotent: only touches rows where displayOrder IS NULL, so re-running it
-- cannot renumber a creator's arrangement.

DO $$
DECLARE
  touched BIGINT;
BEGIN
  WITH ordered AS (
    SELECT
      r.id,
      row_number() OVER (
        PARTITION BY r."projectId", r.type
        ORDER BY
          r."displayOrder" ASC NULLS LAST,
          r.amount ASC,
          r."createdAt" ASC,
          r.id ASC
      ) - 1 AS position
    FROM "Reward" r
    -- Only projects that still have at least one unordered reward.
    WHERE r."projectId" IN (
      SELECT DISTINCT "projectId" FROM "Reward" WHERE "displayOrder" IS NULL
    )
  )
  UPDATE "Reward" r
  SET "displayOrder" = o.position
  FROM ordered o
  WHERE r.id = o.id
    AND r."displayOrder" IS NULL;

  GET DIAGNOSTICS touched = ROW_COUNT;
  RAISE NOTICE 'Backfilled displayOrder on % reward(s).', touched;
END $$;
