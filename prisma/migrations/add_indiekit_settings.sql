-- Per-project IndieKit settings (Settings > Survey / Payments /
-- Notifications toggles). These sections previously posted to an action
-- the API didn't have and persisted nothing; the toggles now live here
-- and gate the real senders (receipt email, failed-payment email,
-- charge auto-retry, creator notifications).
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "indiekitSettings" JSONB;

-- Creator notification for completed surveys (Settings > Notifications >
-- "Survey Completions").
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SURVEY_RESPONSE';
