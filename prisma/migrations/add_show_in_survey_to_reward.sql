-- Add showInSurvey boolean to Reward model
-- Used by IndieKit to track which addons are linked to the survey form
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "showInSurvey" BOOLEAN NOT NULL DEFAULT false;
