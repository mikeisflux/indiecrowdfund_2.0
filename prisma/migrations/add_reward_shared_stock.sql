-- Shared stock between a reward tier and a matching add-on: both draw from one
-- quantity pool instead of each tracking its own count.
-- Run on the production server (auth via ~/.pgpass — never put the password here):
--   psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_reward_shared_stock.sql
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "sharedStockWithId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Reward" ADD CONSTRAINT "Reward_sharedStockWithId_fkey"
    FOREIGN KEY ("sharedStockWithId") REFERENCES "Reward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Reward_sharedStockWithId_idx" ON "Reward"("sharedStockWithId");
