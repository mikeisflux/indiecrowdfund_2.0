-- Scheduled maintenance window and custom message.
-- Idempotent: each column is added only if missing.
ALTER TABLE "PlatformSettings"
    ADD COLUMN IF NOT EXISTS "maintenanceStartsAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "maintenanceEndsAt"   TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "maintenanceMessage"  TEXT;
