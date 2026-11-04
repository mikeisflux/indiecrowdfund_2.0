-- Migration: Agent API call log
-- Backs /api/agent/v1 — the API the NAS-hosted MCP server calls so Claude
-- can read platform data (and run a few guarded writes). Applied
-- automatically by build-and-swap.sh; to run by hand (auth via ~/.pgpass):
--   psql -h localhost -U indieuser -d indiecrowdfund -f prisma/migrations/add_agent_api_calls.sql

CREATE TABLE IF NOT EXISTS "AgentApiCall" (
  "id"         TEXT NOT NULL,
  "apiKeyId"   TEXT,
  "tool"       TEXT NOT NULL,
  "args"       JSONB,
  "ok"         BOOLEAN NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "error"      TEXT,
  "resultSize" INTEGER,
  "ip"         TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentApiCall_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentApiCall_createdAt_idx" ON "AgentApiCall"("createdAt");
CREATE INDEX IF NOT EXISTS "AgentApiCall_apiKeyId_createdAt_idx" ON "AgentApiCall"("apiKeyId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentApiCall_tool_idx" ON "AgentApiCall"("tool");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AgentApiCall_apiKeyId_fkey'
  ) THEN
    ALTER TABLE "AgentApiCall"
      ADD CONSTRAINT "AgentApiCall_apiKeyId_fkey"
      FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
