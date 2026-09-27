-- Marketplace purchases can be charged back like pledges. Until now a
-- dispute on a marketplace charge was acknowledged and dropped, and the
-- disputed sale kept counting toward the creator's balance payout.
ALTER TYPE "MarketplacePurchaseStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';
