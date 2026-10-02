-- Recoups now cover two things: a dispute on one pledge (CHARGEBACK, with
-- the $20 fee) and a creator who was paid out and then owes money back
-- after refunds/chargebacks (OVERPAYMENT, no fee, no single pledge).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecoupKind') THEN
    CREATE TYPE "RecoupKind" AS ENUM ('CHARGEBACK', 'OVERPAYMENT');
  END IF;
END
$$;
ALTER TABLE "ChargebackRecoup" ADD COLUMN IF NOT EXISTS "kind" "RecoupKind" NOT NULL DEFAULT 'CHARGEBACK';
ALTER TABLE "ChargebackRecoup" ALTER COLUMN "pledgeId" DROP NOT NULL;

-- Admin / super-admin owned campaigns are never charged. Their overpaid
-- balance is written off as an internal loss: logged in red on the
-- payout, credited so the balance reads zero.
ALTER TYPE "ChargebackRecoupStatus" ADD VALUE IF NOT EXISTS 'WRITTEN_OFF';
