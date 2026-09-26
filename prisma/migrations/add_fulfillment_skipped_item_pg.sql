-- PostgreSQL replacement for add_fulfillment_skipped_item.sql, which was
-- written in MySQL dialect and can never execute under psql. Production got
-- this table via ad-hoc SQL; this file makes it replayable. Idempotent.

-- Enum shared with the SKU mapping system. Create if missing, then make
-- sure every value exists (an older type may predate MODIFIER_COMBO).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SkuMappingSourceType') THEN
    CREATE TYPE "SkuMappingSourceType" AS ENUM ('REWARD', 'ADDON', 'PROJECT_ITEM', 'MODIFIER_COMBO');
  END IF;
END $$;
ALTER TYPE "SkuMappingSourceType" ADD VALUE IF NOT EXISTS 'REWARD';
ALTER TYPE "SkuMappingSourceType" ADD VALUE IF NOT EXISTS 'ADDON';
ALTER TYPE "SkuMappingSourceType" ADD VALUE IF NOT EXISTS 'PROJECT_ITEM';
ALTER TYPE "SkuMappingSourceType" ADD VALUE IF NOT EXISTS 'MODIFIER_COMBO';

-- Items deliberately excluded from fulfillment (not mapped to a SKU)
CREATE TABLE IF NOT EXISTS "FulfillmentSkippedItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceType" "SkuMappingSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FulfillmentSkippedItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FulfillmentSkippedItem_projectId_sourceType_sourceId_key"
    ON "FulfillmentSkippedItem" ("projectId", "sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "FulfillmentSkippedItem_projectId_idx" ON "FulfillmentSkippedItem" ("projectId");
