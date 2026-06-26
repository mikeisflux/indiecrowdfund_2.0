-- AI service run log — persistent history for the AI Control Center.
-- Idempotent.

CREATE TABLE IF NOT EXISTS "AiRunLog" (
  "id"            TEXT PRIMARY KEY,
  "action"        TEXT NOT NULL,
  "serviceId"     TEXT NOT NULL,
  "success"       BOOLEAN NOT NULL DEFAULT true,
  "message"       TEXT,
  "resultJson"    JSONB,
  "trigger"       TEXT NOT NULL DEFAULT 'manual',
  "triggeredById" TEXT,
  "durationMs"    INTEGER,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AiRunLog_createdAt_idx"            ON "AiRunLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "AiRunLog_serviceId_createdAt_idx"  ON "AiRunLog" ("serviceId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiRunLog_success_idx"              ON "AiRunLog" ("success");

-- Apply on prod:
--   PGPASSWORD='...' psql -h localhost -U indieuser -d indiecrowdfund \
--     -f prisma/migrations/add_ai_run_log.sql
