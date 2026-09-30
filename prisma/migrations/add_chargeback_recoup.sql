-- Chargeback protection cards move to the DivinityCoin vault, and disputes
-- recoup automatically against the vaulted card.
--
-- The card number and CVC go straight from the creator's browser to
-- DivinityCoin (Stripe Elements against DC's publishable key), which
-- verifies the CVC and billing address with a zero-dollar authorization.
-- We hold only the resulting payment-method token and charge it off-session
-- when a dispute lands. Nothing worth stealing is stored here.

ALTER TABLE "CreatorChargebackCard" ADD COLUMN IF NOT EXISTS "divinityCoinPaymentMethodId" TEXT;
ALTER TABLE "CreatorChargebackCard" ADD COLUMN IF NOT EXISTS "divinityCoinCustomerId" TEXT;
ALTER TABLE "CreatorChargebackCard" ADD COLUMN IF NOT EXISTS "divinityCoinSetupIntentId" TEXT;
ALTER TABLE "CreatorChargebackCard" ADD COLUMN IF NOT EXISTS "vaultVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "CreatorChargebackCard_divinityCoinPaymentMethodId_key"
  ON "CreatorChargebackCard"("divinityCoinPaymentMethodId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChargebackRecoupStatus') THEN
    CREATE TYPE "ChargebackRecoupStatus" AS ENUM ('PENDING', 'CHARGED', 'FAILED', 'HELD_BACK', 'WAIVED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ChargebackRecoup" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "pledgeId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "disputeId" TEXT,
  "processor" TEXT,
  "reason" TEXT,
  "disputedAmount" DECIMAL(10,2) NOT NULL,
  "feeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" "ChargebackRecoupStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "divinityCoinPaymentId" TEXT,
  "chargedAt" TIMESTAMP(3),
  "heldBackAt" TIMESTAMP(3),
  "waivedAt" TIMESTAMP(3),
  "waivedById" TEXT,
  "waivedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChargebackRecoup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChargebackRecoup_idempotencyKey_key" ON "ChargebackRecoup"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ChargebackRecoup_divinityCoinPaymentId_key" ON "ChargebackRecoup"("divinityCoinPaymentId");
CREATE INDEX IF NOT EXISTS "ChargebackRecoup_projectId_status_idx" ON "ChargebackRecoup"("projectId", "status");
CREATE INDEX IF NOT EXISTS "ChargebackRecoup_pledgeId_idx" ON "ChargebackRecoup"("pledgeId");
CREATE INDEX IF NOT EXISTS "ChargebackRecoup_status_nextAttemptAt_idx" ON "ChargebackRecoup"("status", "nextAttemptAt");
