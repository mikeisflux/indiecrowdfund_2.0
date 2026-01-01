-- Migration: Add Marketplace Discount Codes
-- Created: 2026-01-01
-- Description: Creates tables for promo code system allowing creators to offer free books

-- Create enum type for discount types
DO $$ BEGIN
    CREATE TYPE "MarketplaceDiscountType" AS ENUM ('FREE_BOOK', 'PERCENTAGE', 'FIXED_AMOUNT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create MarketplaceDiscountCode table
CREATE TABLE IF NOT EXISTS "MarketplaceDiscountCode" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "MarketplaceDiscountType" NOT NULL DEFAULT 'FREE_BOOK',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 1,
    "maxPerCustomer" INTEGER NOT NULL DEFAULT 1,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceDiscountCode_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on code
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceDiscountCode_code_key" ON "MarketplaceDiscountCode"("code");

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "MarketplaceDiscountCode_creatorId_idx" ON "MarketplaceDiscountCode"("creatorId");
CREATE INDEX IF NOT EXISTS "MarketplaceDiscountCode_code_idx" ON "MarketplaceDiscountCode"("code");
CREATE INDEX IF NOT EXISTS "MarketplaceDiscountCode_validFrom_validUntil_idx" ON "MarketplaceDiscountCode"("validFrom", "validUntil");
CREATE INDEX IF NOT EXISTS "MarketplaceDiscountCode_isActive_idx" ON "MarketplaceDiscountCode"("isActive");

-- Add foreign key to User table
ALTER TABLE "MarketplaceDiscountCode"
ADD CONSTRAINT "MarketplaceDiscountCode_creatorId_fkey"
FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create MarketplaceCodeRedemption table
CREATE TABLE IF NOT EXISTS "MarketplaceCodeRedemption" (
    "id" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCodeRedemption_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on purchaseId (one redemption per purchase)
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceCodeRedemption_purchaseId_key" ON "MarketplaceCodeRedemption"("purchaseId");

-- Create unique constraint to prevent duplicate redemptions
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceCodeRedemption_codeId_customerId_bookId_key" ON "MarketplaceCodeRedemption"("codeId", "customerId", "bookId");

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "MarketplaceCodeRedemption_codeId_idx" ON "MarketplaceCodeRedemption"("codeId");
CREATE INDEX IF NOT EXISTS "MarketplaceCodeRedemption_customerId_idx" ON "MarketplaceCodeRedemption"("customerId");
CREATE INDEX IF NOT EXISTS "MarketplaceCodeRedemption_bookId_idx" ON "MarketplaceCodeRedemption"("bookId");

-- Add foreign keys
ALTER TABLE "MarketplaceCodeRedemption"
ADD CONSTRAINT "MarketplaceCodeRedemption_codeId_fkey"
FOREIGN KEY ("codeId") REFERENCES "MarketplaceDiscountCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketplaceCodeRedemption"
ADD CONSTRAINT "MarketplaceCodeRedemption_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketplaceCodeRedemption"
ADD CONSTRAINT "MarketplaceCodeRedemption_bookId_fkey"
FOREIGN KEY ("bookId") REFERENCES "MarketplaceBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketplaceCodeRedemption"
ADD CONSTRAINT "MarketplaceCodeRedemption_purchaseId_fkey"
FOREIGN KEY ("purchaseId") REFERENCES "MarketplacePurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add trigger to update updatedAt on MarketplaceDiscountCode
CREATE OR REPLACE FUNCTION update_marketplace_discount_code_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_marketplace_discount_code_timestamp ON "MarketplaceDiscountCode";
CREATE TRIGGER update_marketplace_discount_code_timestamp
    BEFORE UPDATE ON "MarketplaceDiscountCode"
    FOR EACH ROW
    EXECUTE FUNCTION update_marketplace_discount_code_timestamp();
