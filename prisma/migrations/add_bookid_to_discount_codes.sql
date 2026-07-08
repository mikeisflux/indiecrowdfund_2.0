-- Migration: Add bookId to Marketplace Discount Codes
-- Created: 2026-01-04
-- Description: Links discount codes to specific books

-- Add bookId column to MarketplaceDiscountCode
ALTER TABLE "MarketplaceDiscountCode"
ADD COLUMN IF NOT EXISTS "bookId" TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS "MarketplaceDiscountCode_bookId_idx" ON "MarketplaceDiscountCode"("bookId");

-- Add foreign key to MarketplaceBook table
ALTER TABLE "MarketplaceDiscountCode"
ADD CONSTRAINT "MarketplaceDiscountCode_bookId_fkey"
FOREIGN KEY ("bookId") REFERENCES "MarketplaceBook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update default maxRedemptions to 0 (unlimited)
ALTER TABLE "MarketplaceDiscountCode"
ALTER COLUMN "maxRedemptions" SET DEFAULT 0;

-- Update ALL existing discount codes to be unlimited (maxRedemptions = 0)
UPDATE "MarketplaceDiscountCode"
SET "maxRedemptions" = 0
WHERE "maxRedemptions" > 0;
