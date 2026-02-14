-- Add metadata JSON field to Pledge table for storing pending modifications,
-- completed modifications, pending additional items, etc.
ALTER TABLE "Pledge" ADD COLUMN "metadata" JSONB;
