-- Migration: standing instructions for the marketing AI
-- Plain-English guidance admins (or the Agent API) give the built-in AI
-- marketing; injected into every marketing prompt as operator guidance.
-- Applied automatically by build-and-swap.sh; by hand (auth via ~/.pgpass):
--   psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_ai_marketing_directives.sql

ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "aiMarketingDirectives" TEXT;
