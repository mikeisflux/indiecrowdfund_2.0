import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
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
const LOG_FILES = ["indiecrowdfund-combined.log", "indiecrowdfund-out.log", "indiecrowdfund-error.log"];

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
    const files = LOG_FILES.map((f) => `${LOG_DIR}/${f}`).filter((f) => existsSync(f));
    if (files.length === 0) throw new ToolError(`No log files found in ${LOG_DIR}.`, "not_found", 404);
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
