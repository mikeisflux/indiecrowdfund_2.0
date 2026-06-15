-- ============================================================
-- Add @@unique([surveyId, rewardId]) to SurveyItemQuestion
-- ============================================================
--
-- Why: the IndieKit survey-builder UI lets a creator configure per-
-- reward variants + custom questions ("Reward & Addon Questions" panel).
-- Clicking "Save" POSTs to /api/projects/:id/survey/item-questions,
-- which used to always call db.surveyItemQuestion.create() -- no upsert,
-- no unique constraint. So two paths produced duplicates:
--
--   1. Two quick "Save" clicks before the first response returned. Both
--      see no questionId in client state -> both POST -> two rows for
--      the same (surveyId, rewardId).
--   2. State loss between sessions (refresh, navigate away and back
--      before refetch). Client doesn't have the previous row's id ->
--      sends POST instead of PUT -> third row stacks on top.
--
-- On reload, GET returns all duplicate rows; the UI's
--   for (const q of data.itemQuestions) questionsMap.set(q.rewardId, ..)
-- loop overwrites earlier rows with later ones, and the row Postgres
-- happens to return last wins. With every row having the same
-- sortOrder:0 default, that "last" was the OLDEST row -- showing the
-- creator their first save, not their latest. Exact symptom the
-- creator reported.
--
-- Fix in two parts. This migration:
--   (a) collapses any existing duplicates per (surveyId, rewardId),
--       keeping the most recently UPDATED row + its variants and
--       customQuestions, and
--   (b) adds the unique constraint so future duplicates are impossible
--       at the DB level (POST is now an upsert against this key).

BEGIN;

-- Drop the duplicate rows (and let their variants + customQuestions
-- cascade via FK ON DELETE CASCADE -- which Prisma defines on those
-- relations). Keep the most recently updated row per (surveyId,
-- rewardId).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "surveyId", "rewardId"
           ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
         ) AS rnk
  FROM "SurveyItemQuestion"
)
DELETE FROM "SurveyItemQuestion"
WHERE id IN (SELECT id FROM ranked WHERE rnk > 1);

-- Now the constraint can safely be added.
CREATE UNIQUE INDEX "SurveyItemQuestion_surveyId_rewardId_key"
  ON "SurveyItemQuestion" ("surveyId", "rewardId");

COMMIT;

-- Run on the production box after deploy:
--   PGPASSWORD='...' psql -h localhost -U indieuser -d indiecrowdfund \
--     -f prisma/migrations/add_unique_survey_item_question.sql
--
-- Then verify:
--   SELECT "surveyId", "rewardId", COUNT(*)
--   FROM "SurveyItemQuestion"
--   GROUP BY "surveyId", "rewardId" HAVING COUNT(*) > 1;
-- (Should return 0 rows.)
