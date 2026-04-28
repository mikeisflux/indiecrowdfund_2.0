-- Add CHARGEBACK_RECEIVED and CHARGEBACK_RECOUPED notification types so
-- the PaymentCloud webhook handler can notify creators when a chargeback
-- is filed against one of their pledges + whether the auto-recoup
-- against their saved chargeback card succeeded.
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'CHARGEBACK_RECEIVED'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'CHARGEBACK_RECEIVED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'CHARGEBACK_RECOUPED'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'CHARGEBACK_RECOUPED';
  END IF;
END$$;
