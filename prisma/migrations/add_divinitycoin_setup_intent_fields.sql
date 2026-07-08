-- DivinityCoin AoN saved-card flow (commit d6a46603) — two Pledge
-- columns the Prisma schema added but no migration ever shipped for
-- (the commit said "requires prisma db push on deploy", and the deploy
-- script doesn't run one). Any pledge query that selects them — the
-- backer dashboard, POST /api/pledges, /confirm-dc-setup, and the
-- process-funded-campaigns charge-on-success cron — fails until these
-- exist:
--
--   divinityCoinSetupIntentId   — the DC SetupIntent id (unique)
--   divinityCoinPaymentMethodId — the saved `pm_...` the cron charges
--
-- Idempotent: safe to re-run, and a no-op if a manual `prisma db push`
-- already added the columns.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Pledge' AND column_name = 'divinityCoinSetupIntentId'
  ) THEN
    ALTER TABLE "Pledge" ADD COLUMN "divinityCoinSetupIntentId" TEXT;
    CREATE UNIQUE INDEX "Pledge_divinityCoinSetupIntentId_key"
      ON "Pledge" ("divinityCoinSetupIntentId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Pledge' AND column_name = 'divinityCoinPaymentMethodId'
  ) THEN
    ALTER TABLE "Pledge" ADD COLUMN "divinityCoinPaymentMethodId" TEXT;
  END IF;
END$$;
