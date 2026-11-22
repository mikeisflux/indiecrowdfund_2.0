-- Structured upgrade add-ons + automated survey reminders.
--
-- 1. PledgeModifierAssignment becomes one row per unit of the modifier
--    ("Upgrade to foil" x4 = four rows), and the target may be a tier or an
--    add-on reward. The old unique (pledgeId, modifierAddonId) allowed only
--    one assignment per modifier per pledge, which is why quantity > 1
--    upgrades could never be recorded.
-- 2. Reward.sku / Reward.modifierSkuSuffix give every item a product code
--    and every upgrade a suffix, so "SW3-18" + foil derives "SW3-18-F"
--    without a hand-typed mapping per combination.
-- 3. Survey reminder settings and per-pledge reminder tracking for the
--    survey-reminders cron.

ALTER TABLE "PledgeModifierAssignment" ADD COLUMN IF NOT EXISTS "unitIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PledgeModifierAssignment" ADD COLUMN IF NOT EXISTS "source" TEXT;
DROP INDEX IF EXISTS "PledgeModifierAssignment_pledgeId_modifierAddonId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PledgeModifierAssignment_pledgeId_modifierAddonId_unitIndex_key"
  ON "PledgeModifierAssignment" ("pledgeId", "modifierAddonId", "unitIndex");

ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "modifierSkuSuffix" TEXT;

ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3);
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "autoRemind" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "reminderIntervalDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "maxReminders" INTEGER NOT NULL DEFAULT 4;

ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "surveyReminderCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "surveyReminderSentAt" TIMESTAMP(3);
