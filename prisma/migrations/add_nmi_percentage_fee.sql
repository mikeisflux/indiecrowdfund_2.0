-- PaymentCloud percentage fee (decimal, e.g. 0.045 for 4.5%). Default
-- 0.045 is the rate on the production merchant account. Admins can
-- adjust via /admin/settings → Payments → PaymentCloud Configuration.
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'nmiPercentageFee'
  ) THEN
    ALTER TABLE "PlatformSettings"
      ADD COLUMN "nmiPercentageFee" DOUBLE PRECISION NOT NULL DEFAULT 0.045;
  END IF;
END$$;
