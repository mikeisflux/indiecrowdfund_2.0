-- Add billing address columns to WhopBankAccount and PayPalBankAccount
-- so KYC + chargeback reconciliation works for these payout providers,
-- matching the columns that already exist on DivinityCoinBankAccount
-- and PaymentCloudBankAccount. All nullable because historical rows
-- predate address capture; the form requires them on new saves.

ALTER TABLE "WhopBankAccount"
  ADD COLUMN IF NOT EXISTS "billingLine1Encrypted"   TEXT,
  ADD COLUMN IF NOT EXISTS "billingLine2Encrypted"   TEXT,
  ADD COLUMN IF NOT EXISTS "billingCityEncrypted"    TEXT,
  ADD COLUMN IF NOT EXISTS "billingStateEncrypted"   TEXT,
  ADD COLUMN IF NOT EXISTS "billingZipEncrypted"     TEXT,
  ADD COLUMN IF NOT EXISTS "billingCountryEncrypted" TEXT;

ALTER TABLE "PayPalBankAccount"
  ADD COLUMN IF NOT EXISTS "billingLine1Encrypted"   TEXT,
  ADD COLUMN IF NOT EXISTS "billingLine2Encrypted"   TEXT,
  ADD COLUMN IF NOT EXISTS "billingCityEncrypted"    TEXT,
  ADD COLUMN IF NOT EXISTS "billingStateEncrypted"   TEXT,
  ADD COLUMN IF NOT EXISTS "billingZipEncrypted"     TEXT,
  ADD COLUMN IF NOT EXISTS "billingCountryEncrypted" TEXT;
