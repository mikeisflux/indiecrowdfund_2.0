-- Attachment manifest for in-app messages (files live under uploads/).
-- Nullable JSONB, no default: catalog-only change, safe on the live database.
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
