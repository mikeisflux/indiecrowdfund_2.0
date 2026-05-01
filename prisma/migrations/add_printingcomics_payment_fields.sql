-- Add Printing Comics PayPal-hosted payment fields to ProjectPrintOrder.
-- The 2026-05-01 provider update returns a PayPal approval URL on
-- order create; we cache it here + expiry + provider/reference/paidAt.
ALTER TABLE "ProjectPrintOrder" ADD COLUMN IF NOT EXISTS "paymentApprovalUrl" TEXT;
ALTER TABLE "ProjectPrintOrder" ADD COLUMN IF NOT EXISTS "paymentApprovalUrlExpiresAt" TIMESTAMP(3);
ALTER TABLE "ProjectPrintOrder" ADD COLUMN IF NOT EXISTS "paymentProvider" TEXT;
ALTER TABLE "ProjectPrintOrder" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;
ALTER TABLE "ProjectPrintOrder" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
