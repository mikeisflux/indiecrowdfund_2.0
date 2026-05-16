-- DivinityCoin white-label hosted checkout (DC partner API 2026-05-15).
--
-- Pledges created via the new POST /internal?action=create-checkout-session
-- flow store the returned cs_... id here so the checkout.completed
-- webhook and the user-return callback can both look up the pledge by
-- session id. NULL on every legacy pledge (direct Elements, NMI, PayPal,
-- Whop, Stripe-direct) — purely additive, no FK, no defaults, no table
-- rewrite.
--
-- See WhiteLabelFlip.md "Phase 1 — Additive Support" for the rollout
-- plan. Phase 1 only adds the column + webhook plumbing; nothing writes
-- to this field until Phase 2 lands behind the env flag.
--
-- Idempotent: safe to re-run, no-op if `prisma db push` already added
-- the column (matches the pattern in add_divinitycoin_setup_intent_fields.sql).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Pledge' AND column_name = 'divinityCoinCheckoutSessionId'
  ) THEN
    ALTER TABLE "Pledge" ADD COLUMN "divinityCoinCheckoutSessionId" TEXT;
    CREATE UNIQUE INDEX "Pledge_divinityCoinCheckoutSessionId_key"
      ON "Pledge" ("divinityCoinCheckoutSessionId");
  END IF;
END$$;
