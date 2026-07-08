-- Add PaymentCloud (NMI) Customer Vault id to CreatorChargebackCard +
-- relax the encrypted PAN columns to nullable so new cards stored via
-- Collect.js / vault tokens don't need them. Existing rows are
-- untouched; the nmiCustomerVaultId column is the preferred storage
-- going forward.
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'CreatorChargebackCard' AND column_name = 'nmiCustomerVaultId'
  ) THEN
    ALTER TABLE "CreatorChargebackCard"
      ADD COLUMN "nmiCustomerVaultId" TEXT;
    CREATE UNIQUE INDEX "CreatorChargebackCard_nmiCustomerVaultId_key"
      ON "CreatorChargebackCard" ("nmiCustomerVaultId");
  END IF;

  -- Relax encrypted PAN columns so new vault-only rows can be inserted
  -- without dummy values. Existing rows already have content; this only
  -- changes nullability.
  ALTER TABLE "CreatorChargebackCard"
    ALTER COLUMN "cardNumberEncrypted"   DROP NOT NULL,
    ALTER COLUMN "expMonthEncrypted"     DROP NOT NULL,
    ALTER COLUMN "expYearEncrypted"      DROP NOT NULL,
    ALTER COLUMN "cvcEncrypted"          DROP NOT NULL,
    ALTER COLUMN "billingNameEncrypted"  DROP NOT NULL,
    ALTER COLUMN "billingLine1Encrypted" DROP NOT NULL,
    ALTER COLUMN "billingCityEncrypted"  DROP NOT NULL,
    ALTER COLUMN "billingStateEncrypted" DROP NOT NULL,
    ALTER COLUMN "billingZipEncrypted"   DROP NOT NULL,
    ALTER COLUMN "billingCountryEncrypted" DROP NOT NULL;
END$$;
