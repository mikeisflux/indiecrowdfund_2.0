-- Track Printing Comics print-fulfillment state per Pledge so the
-- backers table + webhook receiver can show / update status without
-- polling every refresh.
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "printingComicsOrderId" TEXT;
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "printingComicsOrderNumber" TEXT;
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "printingComicsStatus" TEXT;
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "printingComicsTrackingNumber" TEXT;
ALTER TABLE "Pledge" ADD COLUMN IF NOT EXISTS "printingComicsLastSyncedAt" TIMESTAMP(3);

-- pledge.id doubles as Printing Comics' externalRef, so the order id
-- they return is also unique per pledge — index it for the webhook
-- receiver's lookup-by-order-id.
CREATE UNIQUE INDEX IF NOT EXISTS "Pledge_printingComicsOrderId_key"
  ON "Pledge" ("printingComicsOrderId");
