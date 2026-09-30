-- Where the chargeback protection card was entered. Sent to DivinityCoin as
-- the customer origin on recoup charges, which run off-session with no
-- browser present (PARTNER-CUSTOMER-ORIGIN spec, "scheduled and off-session
-- charges": send the IP recorded when the payment method was saved).
ALTER TABLE "CreatorChargebackCard" ADD COLUMN IF NOT EXISTS "savedFromIp" TEXT;
ALTER TABLE "CreatorChargebackCard" ADD COLUMN IF NOT EXISTS "savedFromUserAgent" TEXT;
