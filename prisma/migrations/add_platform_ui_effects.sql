-- Visual-effects configuration bucket for /admin/themes.
-- Nullable JSONB, no default: catalog-only change, safe on the live database.
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "uiEffects" JSONB;
