-- Creators are now shown rejection / changes-requested feedback on a
-- blocking page at their next visit. acknowledgedAt records that they
-- read it; the builder keeps showing the feedback until resubmission.
ALTER TABLE "ProjectReview" ADD COLUMN IF NOT EXISTS "acknowledgedAt" TIMESTAMP(3);

-- In-app notification type for review outcomes (rejected / changes requested).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_REVIEW';
