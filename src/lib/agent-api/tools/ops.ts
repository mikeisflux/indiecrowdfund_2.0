import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync, readdirSync, statSync } from "fs";
import { db } from "@/lib/db";
import { defineTool, SCOPE_AGENT_READ, ToolError } from "../registry";
import { Limit } from "../shared";

const run = promisify(execFile);

defineTool({
  name: "sentinel_errors",
  description: "Error groups from Sentinel (the built-in error tracker): title, level, source, counts, first/last seen. Default: unresolved errors seen in the last 24 hours.",
  scope: SCOPE_AGENT_READ,
  input: z.object({
    status: z.array(z.enum(["UNRESOLVED", "IN_PROGRESS", "RESOLVED", "IGNORED"])).default(["UNRESOLVED"]),
    hours: z.number().int().min(1).max(720).default(24).describe("Only groups last seen within this many hours."),
    search: z.string().optional().describe("Substring match on the error title."),
    limit: Limit(25, 100),
  }),
  handler: async (a) => {
    const groups = await db.errorGroup.findMany({
      where: {
        status: { in: [...a.status] },
        lastSeen: { gte: new Date(Date.now() - a.hours * 3_600_000) },
        ...(a.search ? { title: { contains: a.search, mode: "insensitive" } } : {}),
      },
      orderBy: { lastSeen: "desc" },
      take: a.limit,
      select: { id: true, title: true, type: true, level: true, source: true, endpoint: true, status: true, eventCount: true, firstSeen: true, lastSeen: true, latestMetadata: true },
    });
    return { errors: groups.map((g: { id: string } & Record<string, unknown>) => ({ ...g, adminUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com"}/admin/error-logs?group=${g.id}` })) };
  },
});

defineTool({
  name: "sentinel_error_detail",
  description: "Full detail for one Sentinel error group: latest message, stack trace, metadata and the most recent occurrences with URL, method, status and user.",
  scope: SCOPE_AGENT_READ,
  input: z.object({ groupId: z.string(), occurrences: Limit(10, 50) }),
  handler: async (a) => {
    const g = await db.errorGroup.findFirst({
      where: { id: a.groupId },
      select: {
        id: true, title: true, type: true, level: true, source: true, endpoint: true, status: true, eventCount: true, firstSeen: true, lastSeen: true,
        latestMessage: true, latestStack: true, latestMetadata: true,
        occurrences: { orderBy: { timestamp: "desc" }, take: a.occurrences, select: { message: true, url: true, method: true, statusCode: true, userId: true, timestamp: true } },
      },
    });
    if (!g) throw new ToolError(`No error group ${a.groupId}.`, "not_found", 404);
    return g;
  },
});

const LOG_DIR = process.env.AGENT_LOG_DIR || "/var/log/pm2";

// pm2 names and places its log files per host config (pm2 start flags,
// logrotate suffixes like indiecrowdfund-out-0.log or
// indiecrowdfund-combined__2026-11-12_00-00-00.log, ~/.pm2/logs on a
// default install). A fixed list of three names found nothing on the
// production box. Ask pm2 where the app's logs are, then fall back to
// scanning the usual directories for anything named after the app.
async function discoverLogFiles(): Promise<string[]> {
  const found = new Set<string>();
  try {
    const res = await run("pm2", ["jlist"], { timeout: 8000, maxBuffer: 8 * 1024 * 1024 });
    const list = JSON.parse(res.stdout) as { name?: string; pm2_env?: { pm_out_log_path?: string; pm_err_log_path?: string; pm_log_path?: string } }[];
    for (const proc of list) {
      if (proc.name && !/indiecrowdfund/i.test(proc.name)) continue;
      for (const f of [proc.pm2_env?.pm_log_path, proc.pm2_env?.pm_out_log_path, proc.pm2_env?.pm_err_log_path]) {
        if (f && existsSync(f)) found.add(f);
      }
    }
  } catch {
    // pm2 not on PATH for this process, or not JSON; scan directories.
  }
  const dirs = [LOG_DIR, `${process.env.HOME || "/root"}/.pm2/logs`, "/root/.pm2/logs", "/var/log/pm2"];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    let names: string[] = [];
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    const candidates = names
      .filter((n) => /^indiecrowdfund.*\.log$/i.test(n))
      .map((n) => `${dir}/${n}`)
      .map((f) => ({ f, mtime: (() => { try { return statSync(f).mtimeMs; } catch { return 0; } })() }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 6);
    for (const c of candidates) found.add(c.f);
  }
  return [...found];
}

defineTool({
  name: "search_logs",
  description:
    "Search the application's pm2 logs for a literal string (a pledge id, user id, email, correlationId, or message text) and return the most recent matching lines. Each line is a JSON log entry. Use it to trace what happened to one pledge or request.",
  scope: SCOPE_AGENT_READ,
  input: z.object({
    query: z.string().min(3).max(200).describe("Literal text to look for (not a regex)."),
    lines: z.number().int().min(1).max(300).default(50).describe("Most recent matching lines to return."),
    maxLineLength: z.number().int().min(100).max(5000).default(1200),
  }),
  handler: async (a) => {
    const files = await discoverLogFiles();
    if (files.length === 0) {
      throw new ToolError(
        `No pm2 log files found (looked at pm2 jlist, ${LOG_DIR} and ~/.pm2/logs). Set AGENT_LOG_DIR to the directory pm2 writes to.`,
        "not_found",
        404
      );
    }
    // execFile with an argument array: the query is passed as data, never
    // interpolated into a shell, so it cannot inject commands.
    let out = "";
    try {
      const res = await run("grep", ["-h", "-F", "--", a.query, ...files], { maxBuffer: 64 * 1024 * 1024 });
      out = res.stdout;
    } catch (err) {
      // grep exits 1 for "no matches"; anything else is a real failure.
      const e = err as { code?: number; stdout?: string };
      if (e.code === 1) out = e.stdout ?? "";
      else throw err;
    }
    const all = out.split("\n").filter(Boolean);
    const picked = all.slice(-a.lines).map((l) => (l.length > a.maxLineLength ? l.slice(0, a.maxLineLength) + "…" : l));
    return { query: a.query, totalMatches: all.length, returned: picked.length, lines: picked };
  },
});

defineTool({
  name: "agent_call_log",
  description: "Recent calls made through this Agent API (by any key): tool, outcome, duration. Useful to see what an earlier session already asked for.",
  scope: SCOPE_AGENT_READ,
  input: z.object({ limit: Limit(50, 200), tool: z.string().optional() }),
  handler: async (a) => {
    const calls = await db.agentApiCall.findMany({
      where: a.tool ? { tool: a.tool } : {},
      orderBy: { createdAt: "desc" },
      take: a.limit,
      select: { tool: true, ok: true, statusCode: true, durationMs: true, error: true, createdAt: true, apiKey: { select: { name: true } } },
    });
    return {
      calls: calls.map((c: { apiKey: { name: string } | null } & Record<string, unknown>) => ({ ...c, key: c.apiKey?.name ?? null, apiKey: undefined })),
    };
  },
});
