-- Report Spam: remember the Mailgun route created for a provider-level block
-- so lifting the block can delete it instead of leaving an orphaned route.
-- Run on the production server (auth via ~/.pgpass — never put the password here):
--   psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_email_blocklist_provider_route.sql
ALTER TABLE "EmailBlocklist" ADD COLUMN IF NOT EXISTS "providerRouteId" TEXT;
