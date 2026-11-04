import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "@/lib/db";
import { defineTool, SCOPE_AGENT_READ, ToolError } from "../registry";

const run = promisify(execFile);

/**
 * "Commands on the box": read-only SQL against the production database and
 * a health snapshot of the server. Deliberately NOT an open shell — an API
 * key that can run arbitrary commands as the app user is a key that, if it
 * leaks, hands the box over. Read-only SQL inside a READ ONLY transaction
 * with a statement timeout gives an agent every question it can ask of the
 * data while keeping writes behind the purpose-built tools.
 */

const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|reindex|cluster|lock|call|do|refresh|reset|set\s+role|pg_sleep|pg_read|pg_write|lo_|dblink|pg_terminate|pg_cancel)\b/i;
const SECRET_COLUMNS = /\b(password|secretHash|keyHash|apiKey|apiSecret|accessToken|refreshToken|stripeSecret|webhookSecret|Encrypted|cvc|cardNumber|routingNumber|accountNumber)\b/i;

function serialize(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toNumber" in (value as object) && typeof (value as { toNumber: unknown }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  if (typeof value === "string" && value.length > 2000) return value.slice(0, 2000) + "…";
  return value;
}

defineTool({
  name: "run_sql",
  description:
    "Run a read-only SQL query (SELECT / WITH / EXPLAIN) against the production Postgres database and get the rows back. One statement, 15-second timeout, up to 500 rows. Table and column names are quoted CamelCase as in the Prisma schema, e.g. SELECT title, \"goalAmount\" FROM \"Project\" WHERE status = 'LIVE'. Columns holding passwords, hashes, tokens, card or bank data are refused. Prefer the purpose-built tools when one fits; use this for questions they don't cover.",
  scope: SCOPE_AGENT_READ,
  input: z.object({
    sql: z.string().min(6).max(8000),
    maxRows: z.number().int().min(1).max(500).default(200),
  }),
  handler: async (a) => {
    const sql = a.sql.trim().replace(/;\s*$/, "");
    if (sql.includes(";")) throw new ToolError("One statement per call.", "invalid_arguments");
    if (!/^(select|with|explain)\b/i.test(sql)) throw new ToolError("Only SELECT, WITH or EXPLAIN statements are allowed.", "invalid_arguments");
    if (FORBIDDEN.test(sql)) throw new ToolError("That statement contains a write or administrative keyword and was refused.", "invalid_arguments");
    if (SECRET_COLUMNS.test(sql)) throw new ToolError("That query names a secret-bearing column (password, hash, token, card or bank data) and was refused.", "invalid_arguments");

    const started = Date.now();
    const rows = await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout = 15000");
        return tx.$queryRawUnsafe(sql);
      },
      { timeout: 20_000, maxWait: 5_000 }
    );
    const list = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];
    const limited = list.slice(0, a.maxRows).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, serialize(v)])));
    return { rowCount: list.length, returned: limited.length, truncated: list.length > a.maxRows, durationMs: Date.now() - started, rows: limited };
  },
});

async function tryRun(cmd: string, args: string[]): Promise<string | null> {
  try {
    const res = await run(cmd, args, { timeout: 8000, maxBuffer: 4 * 1024 * 1024 });
    return res.stdout;
  } catch {
    return null;
  }
}

defineTool({
  name: "server_status",
  description: "Health snapshot of the IndieCrowdfund server: app workers (pm2), memory and disk, uptime, database reachability, email queue depth, and the last cron and AI runs.",
  scope: SCOPE_AGENT_READ,
  input: z.object({}),
  handler: async () => {
    const [pm2Raw, df, free, uptime] = await Promise.all([tryRun("pm2", ["jlist"]), tryRun("df", ["-h", "/"]), tryRun("free", ["-m"]), tryRun("uptime", [])]);
    let workers: unknown = null;
    if (pm2Raw) {
      try {
        const list = JSON.parse(pm2Raw) as { name: string; pm_id: number; pm2_env?: { status?: string; restart_time?: number; pm_uptime?: number }; monit?: { memory?: number; cpu?: number } }[];
        workers = list.map((p) => ({ name: p.name, id: p.pm_id, status: p.pm2_env?.status, restarts: p.pm2_env?.restart_time, memoryMb: p.monit?.memory ? Math.round(p.monit.memory / 1048576) : null, cpu: p.monit?.cpu ?? null, since: p.pm2_env?.pm_uptime ? new Date(p.pm2_env.pm_uptime).toISOString() : null }));
      } catch {
        workers = "pm2 jlist returned non-JSON";
      }
    }
    const since24h = new Date(Date.now() - 86_400_000);
    const [dbTime, queuePending, queueFailed24h, lastAiRun, errors24h] = await Promise.all([
      db.$queryRawUnsafe("SELECT now() AS now").then((r: unknown) => ((r as { now: Date }[])[0]?.now ?? null)).catch(() => null),
      db.emailQueue.count({ where: { status: "PENDING" } }).catch(() => null),
      db.emailQueue.count({ where: { status: "FAILED", processedAt: { gte: since24h } } }).catch(() => null),
      db.aiRunLog.findFirst({ orderBy: { createdAt: "desc" }, select: { serviceId: true, success: true, message: true, createdAt: true } }).catch(() => null),
      db.errorGroup.count({ where: { status: "UNRESOLVED", lastSeen: { gte: since24h } } }).catch(() => null),
    ]);
    return {
      checkedAt: new Date().toISOString(),
      database: { reachable: !!dbTime, serverTime: dbTime },
      app: { workers, uptime: uptime?.trim() ?? null },
      memory: free?.trim() ?? null,
      disk: df?.trim() ?? null,
      emailQueue: { pending: queuePending, failedLast24h: queueFailed24h },
      lastAiRun,
      unresolvedErrorsLast24h: errors24h,
    };
  },
});
