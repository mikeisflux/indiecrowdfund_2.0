-- One row per refund asked of DivinityCoin (see DcRefundAttempt in
-- prisma/schema/payment.prisma). Blocks a second refund of the same payment
-- while an earlier one is in flight or unanswered.
CREATE TABLE IF NOT EXISTS "DcRefundAttempt" (
  "id" TEXT PRIMARY KEY,
  "paymentId" TEXT NOT NULL,
  "pledgeId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "purpose" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "status" TEXT NOT NULL,
  "refundId" TEXT,
  "error" TEXT,
  "code" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DcRefundAttempt_idempotencyKey_key" ON "DcRefundAttempt"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "DcRefundAttempt_paymentId_status_idx" ON "DcRefundAttempt"("paymentId", "status");
CREATE INDEX IF NOT EXISTS "DcRefundAttempt_pledgeId_idx" ON "DcRefundAttempt"("pledgeId");
CREATE INDEX IF NOT EXISTS "DcRefundAttempt_status_createdAt_idx" ON "DcRefundAttempt"("status", "createdAt");
