-- Carrier + URL for a pledge's tracking number, so the backer dashboard can
-- turn it into a link instead of printing a bare string.
--
-- Shopify returns a tracking_url on the fulfillment and ShipStation names the
-- carrier; storing both means the link comes from what the carrier actually
-- said rather than from guessing at the number's shape.
--
-- Safe on a live site: both columns are nullable with no default, which
-- Postgres 11+ applies as a catalog update — no table rewrite, no scan. No
-- index: nothing looks a pledge up by carrier. lock_timeout stops the
-- statement queueing behind a long transaction and blocking pledge writes.
--
-- Run on the production server (auth via ~/.pgpass — never put the password here):
--   psql -h localhost -U indieuser -d indiecrowdfund -v ON_ERROR_STOP=1 \
--     -f prisma/migrations/add_pledge_tracking_carrier.sql

SET lock_timeout = '3s';

ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "trackingCarrier" TEXT;
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "trackingUrl"     TEXT;
