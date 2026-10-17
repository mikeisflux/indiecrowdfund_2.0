-- A recoup charge an admin sends back to the creator's card: wrongly
-- opened (e.g. an "overpayment" on a campaign never paid out) or a dispute
-- the platform later won.
ALTER TYPE "ChargebackRecoupStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TABLE "ChargebackRecoup" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
ALTER TABLE "ChargebackRecoup" ADD COLUMN IF NOT EXISTS "refundedById" TEXT;
ALTER TABLE "ChargebackRecoup" ADD COLUMN IF NOT EXISTS "divinityCoinRefundId" TEXT;
