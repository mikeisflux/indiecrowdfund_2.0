-- Who completed a survey response: the backer, or the creator on their
-- behalf from IndieKit. See SurveyResponse.completedBy.
ALTER TABLE "SurveyResponse" ADD COLUMN IF NOT EXISTS "completedBy" TEXT;
ALTER TABLE "SurveyResponse" ADD COLUMN IF NOT EXISTS "completedById" TEXT;
