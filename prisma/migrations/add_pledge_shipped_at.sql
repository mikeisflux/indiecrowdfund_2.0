-- Rating requests used to fire the moment an order was marked shipped —
-- i.e. when the label was printed — asking backers to rate a book they
-- hadn't received. Record when shipping happened and wait 10 days.
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "shippedAt" TIMESTAMP(3);
-- Best available date for orders shipped before this column existed.
UPDATE "Pledge" SET "shippedAt" = "updatedAt"
WHERE "shippedAt" IS NULL AND "fulfillmentStatus" IN ('SHIPPED','DELIVERED');
CREATE INDEX IF NOT EXISTS "Pledge_shippedAt_idx" ON "Pledge"("shippedAt");
