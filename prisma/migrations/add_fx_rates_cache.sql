-- Currency display for non-USD campaigns (May 17, 2026).
--
-- Adds a JSON column on PlatformSettings that src/lib/currency.ts
-- uses as a 24h cache of USD-to-X exchange rates pulled from
-- Frankfurter (api.frankfurter.app, ECB-sourced, no auth). Shape
-- per entry:
--
--   { "GBP": { "rate": 0.79, "fetchedAt": "2026-05-17T12:00:00Z" },
--     "EUR": { "rate": 0.92, "fetchedAt": "..." }, ... }
--
-- Lazy-populated on first request per currency. Stale entries
-- (older than 24h) are refreshed on access; if Frankfurter is
-- briefly unreachable we serve the stale value rather than blank
-- the display. NULL on first install — that's fine, the cache
-- self-populates on first non-USD campaign render.
--
-- Idempotent: re-running this migration is a no-op once the
-- column exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PlatformSettings' AND column_name = 'fxRatesUsd'
  ) THEN
    ALTER TABLE "PlatformSettings" ADD COLUMN "fxRatesUsd" JSONB;
  END IF;
END$$;
