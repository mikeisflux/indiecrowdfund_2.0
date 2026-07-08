-- PaymentCloud (NMI white-label) per-pledge fields. Customer Vault token
-- + transaction ids drive charge-on-success and refund routing.
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Pledge' AND column_name = 'nmiCustomerVaultId'
  ) THEN
    ALTER TABLE "Pledge"
      ADD COLUMN "nmiCustomerVaultId" TEXT;
    CREATE UNIQUE INDEX "Pledge_nmiCustomerVaultId_key"
      ON "Pledge" ("nmiCustomerVaultId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Pledge' AND column_name = 'nmiInitialTransactionId'
  ) THEN
    ALTER TABLE "Pledge"
      ADD COLUMN "nmiInitialTransactionId" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Pledge' AND column_name = 'nmiTransactionId'
  ) THEN
    ALTER TABLE "Pledge"
      ADD COLUMN "nmiTransactionId" TEXT;
    CREATE UNIQUE INDEX "Pledge_nmiTransactionId_key"
      ON "Pledge" ("nmiTransactionId");
  END IF;
END$$;
