-- Lease column for in-flight recoup charges (see ChargebackRecoup.lockedAt).
ALTER TABLE "ChargebackRecoup" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
