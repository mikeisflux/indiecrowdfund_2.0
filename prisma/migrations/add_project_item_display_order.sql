-- Creator-chosen ordering for project items (builder Items tab). Without this
-- the drag order and the chosen sort were client-only and lost on reload.
-- Run on the production server (auth via ~/.pgpass — never put the password here):
--   psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_project_item_display_order.sql
ALTER TABLE "ProjectItem" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER;
