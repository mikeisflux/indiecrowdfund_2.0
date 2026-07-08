-- NMI per-transaction gateway fee (in USD). Default 0.13 matches the
-- production merchant account's $0.13/txn fee. Admins can adjust via
-- /admin/settings → Payments → NMI Configuration.
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'nmiPerTransactionFee'
  ) THEN
    ALTER TABLE "PlatformSettings"
      ADD COLUMN "nmiPerTransactionFee" DOUBLE PRECISION NOT NULL DEFAULT 0.13;
  END IF;
END$$;
