-- PaymentCloud (NMI) per-purchase fields on MarketplacePurchase.
-- nmiCustomerVaultId stores the Customer Vault token; nmiTransactionId
-- is the sale id used for refunds. Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'MarketplacePurchase' AND column_name = 'nmiCustomerVaultId'
  ) THEN
    ALTER TABLE "MarketplacePurchase"
      ADD COLUMN "nmiCustomerVaultId" TEXT;
    CREATE UNIQUE INDEX "MarketplacePurchase_nmiCustomerVaultId_key"
      ON "MarketplacePurchase" ("nmiCustomerVaultId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'MarketplacePurchase' AND column_name = 'nmiTransactionId'
  ) THEN
    ALTER TABLE "MarketplacePurchase"
      ADD COLUMN "nmiTransactionId" TEXT;
    CREATE UNIQUE INDEX "MarketplacePurchase_nmiTransactionId_key"
      ON "MarketplacePurchase" ("nmiTransactionId");
  END IF;
END$$;
