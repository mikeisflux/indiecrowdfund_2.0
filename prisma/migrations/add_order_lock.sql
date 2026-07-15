-- Order lock feature: per-backer "confirm & lock your order" handshake a
-- creator can send (even during a live campaign). On approval the backer
-- confirms address + selections and the order is frozen for print/ship.

-- New enum for the per-pledge lock state.
DO $$ BEGIN
  CREATE TYPE "OrderLockStatus" AS ENUM ('UNLOCKED', 'LOCK_REQUESTED', 'LOCKED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Per-pledge lock columns.
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "orderLockStatus" "OrderLockStatus" NOT NULL DEFAULT 'UNLOCKED';
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "orderLockRequestedAt" TIMESTAMP(3);
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "orderLockedAt" TIMESTAMP(3);
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "orderLockDeclinedAt" TIMESTAMP(3);

-- Helps the creator status board query (per project, by lock state).
CREATE INDEX IF NOT EXISTS "Pledge_projectId_orderLockStatus_idx"
  ON "Pledge" ("projectId", "orderLockStatus");

-- New notification + activity-log enum values.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_LOCK_REQUESTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'ORDER_LOCK_REQUESTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'ORDER_LOCK_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'ORDER_LOCK_DECLINED';
