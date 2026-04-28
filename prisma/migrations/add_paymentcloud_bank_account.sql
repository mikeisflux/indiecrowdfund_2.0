-- New PaymentCloudBankAccount table + extensions on DivinityCoinBankAccount
-- so creators can split their account holder into first/last name and
-- attach a billing address. Idempotent: safe to re-run.

DO $$
BEGIN
  -- 1. PaymentCloudBankAccount: brand new table for PaymentCloud (NMI)
  --    creator payout details. Same shape as DivinityCoinBankAccount.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'PaymentCloudBankAccount'
  ) THEN
    CREATE TABLE "PaymentCloudBankAccount" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "bankNameEncrypted" TEXT NOT NULL,
      "accountHolderFirstNameEncrypted" TEXT NOT NULL,
      "accountHolderLastNameEncrypted" TEXT NOT NULL,
      "accountNumberEncrypted" TEXT NOT NULL,
      "routingNumberEncrypted" TEXT NOT NULL,
      "billingLine1Encrypted" TEXT NOT NULL,
      "billingLine2Encrypted" TEXT,
      "billingCityEncrypted" TEXT NOT NULL,
      "billingStateEncrypted" TEXT NOT NULL,
      "billingZipEncrypted" TEXT NOT NULL,
      "billingCountryEncrypted" TEXT NOT NULL,
      "bankNameDisplay" TEXT,
      "accountLastFour" TEXT,
      "accountType" TEXT NOT NULL DEFAULT 'checking',
      "isVerified" BOOLEAN NOT NULL DEFAULT false,
      "verifiedAt" TIMESTAMP(3),
      "verificationMethod" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PaymentCloudBankAccount_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "PaymentCloudBankAccount_userId_key" ON "PaymentCloudBankAccount" ("userId");
    CREATE INDEX "PaymentCloudBankAccount_userId_idx" ON "PaymentCloudBankAccount" ("userId");
    ALTER TABLE "PaymentCloudBankAccount"
      ADD CONSTRAINT "PaymentCloudBankAccount_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- 2. DivinityCoinBankAccount: add split first/last name + billing
  --    address columns. accountHolderEncrypted is relaxed to nullable.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DivinityCoinBankAccount'
      AND column_name = 'accountHolderFirstNameEncrypted'
  ) THEN
    ALTER TABLE "DivinityCoinBankAccount"
      ADD COLUMN "accountHolderFirstNameEncrypted" TEXT,
      ADD COLUMN "accountHolderLastNameEncrypted"  TEXT,
      ADD COLUMN "billingLine1Encrypted"   TEXT,
      ADD COLUMN "billingLine2Encrypted"   TEXT,
      ADD COLUMN "billingCityEncrypted"    TEXT,
      ADD COLUMN "billingStateEncrypted"   TEXT,
      ADD COLUMN "billingZipEncrypted"     TEXT,
      ADD COLUMN "billingCountryEncrypted" TEXT;
    ALTER TABLE "DivinityCoinBankAccount"
      ALTER COLUMN "accountHolderEncrypted" DROP NOT NULL;
  END IF;
END$$;
