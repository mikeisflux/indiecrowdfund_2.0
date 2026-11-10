-- Migration: turn the promo popup slideshow off
-- The "AI-Powered Campaign Tools" slideshow fired on every visitor's first
-- page view. Disable every configured popup and make new ones start off;
-- Admin → Customization → Promo Popup re-enables it on purpose.
-- Applied automatically by build-and-swap.sh; by hand (auth via ~/.pgpass):
--   psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/disable_promo_popup.sql

UPDATE "PromoPopup" SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "isActive" = true;
ALTER TABLE "PromoPopup" ALTER COLUMN "isActive" SET DEFAULT false;
