-- UK (international) bank account support for the DivinityCoin, PayPal,
-- and Whop creator payout tables — mirrors the bankCountry +
-- payoutPhoneEncrypted columns already on PaymentCloudBankAccount.
--
-- bankCountry drives routing-format selection (US 9-digit ABA routing
-- number vs UK 6-digit Sort Code), validation, and the destination
-- payout rail. payoutPhoneEncrypted holds the payout-contact phone UK
-- banks require on the payee record. Every pre-existing row predates
-- international support and is a US ACH account by definition, so
-- bankCountry defaults to 'US'.
--
-- Idempotent: safe to re-run.

DO $$
BEGIN
  -- DivinityCoinBankAccount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DivinityCoinBankAccount' AND column_name = 'bankCountry'
  ) THEN
    ALTER TABLE "DivinityCoinBankAccount"
      ADD COLUMN "bankCountry" TEXT NOT NULL DEFAULT 'US',
      ADD COLUMN "payoutPhoneEncrypted" TEXT;
  END IF;

  -- PayPalBankAccount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PayPalBankAccount' AND column_name = 'bankCountry'
  ) THEN
    ALTER TABLE "PayPalBankAccount"
      ADD COLUMN "bankCountry" TEXT NOT NULL DEFAULT 'US',
      ADD COLUMN "payoutPhoneEncrypted" TEXT;
  END IF;

  -- WhopBankAccount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'WhopBankAccount' AND column_name = 'bankCountry'
  ) THEN
    ALTER TABLE "WhopBankAccount"
      ADD COLUMN "bankCountry" TEXT NOT NULL DEFAULT 'US',
      ADD COLUMN "payoutPhoneEncrypted" TEXT;
  END IF;
END$$;
