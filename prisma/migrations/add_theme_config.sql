-- Theme overrides for /admin/themes (prisma/schema/platform.prisma).
-- Catalog-only one-shot; run on the production server before deploying
-- the build that includes PlatformSettings.themeConfig:
--
--   psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_theme_config.sql

ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "themeConfig" JSONB;
