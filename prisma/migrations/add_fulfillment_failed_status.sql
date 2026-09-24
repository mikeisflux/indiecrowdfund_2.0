-- Fulfillment push-error tracking.
--
-- The IndieKit Packages tab has always shown a "Push Errored" count and a
-- "Re-push all errored orders" button, but FulfillmentStatus had no FAILED
-- value, so no pledge could ever be in that state and the count was
-- permanently zero. The ShipStation push now records FAILED on a pledge
-- whose order could not be created, and retry_errored re-pushes them.
ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'FAILED';

-- Declared customs value for international packages. FulfillmentProduct had
-- description / country-of-origin / HS code fields but nowhere to keep the
-- declared value the Edit Customs dialog collects.
ALTER TABLE "FulfillmentProduct" ADD COLUMN IF NOT EXISTS "declaredValue" DECIMAL(10,2);
