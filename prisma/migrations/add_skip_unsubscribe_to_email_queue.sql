-- Migration: Add skipUnsubscribeCheck to EmailQueue
-- Description: Transactional emails (password reset, verification) need
-- to be delivered even when the recipient unsubscribed from marketing.
-- Without persisting this flag on the queue row, the worker re-checks
-- unsubscribe status on every retry and silently drops the email.
-- Idempotent: safe to re-run.

ALTER TABLE "EmailQueue"
ADD COLUMN IF NOT EXISTS "skipUnsubscribeCheck" BOOLEAN NOT NULL DEFAULT false;
