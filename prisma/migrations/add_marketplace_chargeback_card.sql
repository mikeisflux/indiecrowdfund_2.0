-- User-level chargeback protection card for marketplace creators.
-- Same PaymentCloud Customer Vault pattern as CreatorChargebackCard
-- but per-user instead of per-project, since marketplace sales are
-- user-level transactions.
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'CreatorMarketplaceChargebackCard'
  ) THEN
    CREATE TABLE "CreatorMarketplaceChargebackCard" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "nmiCustomerVaultId" TEXT NOT NULL,
      "cardLastFour" TEXT NOT NULL,
      "cardBrand" TEXT,
      "expMonth" INTEGER NOT NULL,
      "expYear" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "CreatorMarketplaceChargebackCard_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "CreatorMarketplaceChargebackCard_userId_key"
      ON "CreatorMarketplaceChargebackCard" ("userId");
    CREATE UNIQUE INDEX "CreatorMarketplaceChargebackCard_nmiCustomerVaultId_key"
      ON "CreatorMarketplaceChargebackCard" ("nmiCustomerVaultId");
    CREATE INDEX "CreatorMarketplaceChargebackCard_userId_idx"
      ON "CreatorMarketplaceChargebackCard" ("userId");
    ALTER TABLE "CreatorMarketplaceChargebackCard"
      ADD CONSTRAINT "CreatorMarketplaceChargebackCard_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
