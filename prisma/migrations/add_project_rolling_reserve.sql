-- PaymentCloud rolling reserve fields on Project. PaymentCloud holds
-- 10% of gross campaign revenue for 180 days as chargeback protection.
-- Projects raising over $2,500 auto-trigger; admins can manually flag
-- new / high-risk creators regardless of amount.
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Project' AND column_name = 'rollingReserveSubject'
  ) THEN
    ALTER TABLE "Project"
      ADD COLUMN "rollingReserveSubject"   BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN "rollingReserveAuto"      BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN "rollingReserveAmount"    DECIMAL(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN "rollingReserveHeldAt"    TIMESTAMP(3),
      ADD COLUMN "rollingReserveReleaseAt" TIMESTAMP(3),
      ADD COLUMN "rollingReserveReleased"  BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN "rollingReserveReleasedAt" TIMESTAMP(3);
  END IF;
END$$;
