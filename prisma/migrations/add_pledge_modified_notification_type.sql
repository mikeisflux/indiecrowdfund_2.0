-- Add PLEDGE_MODIFIED and PLEDGE_REFUND_DECISION to the NotificationType enum.
-- These were referenced in code (src/lib/notifications/types.ts +
-- pledge-notifications.ts) but never added to the Postgres enum, so
-- notification writes for pledge modifications/refund decisions were
-- silently failing at runtime with PrismaClientValidationError.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PLEDGE_MODIFIED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PLEDGE_REFUND_DECISION';
