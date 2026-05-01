-- Add Printing Comics fulfillment integration fields to PlatformSettings.
-- Provider docs aren't public yet, so the field set is the standard shape
-- a third-party API integration uses: API key + environment + webhook
-- secret slot. More fields can be added as printingcomics.com publishes
-- the actual spec.
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "printingComicsApiKey" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "printingComicsWebhookSecret" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "printingComicsEnvironment" TEXT NOT NULL DEFAULT 'production';
