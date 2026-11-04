import { describe, it, expect, vi, beforeAll } from "vitest";
import { writeFileSync } from "fs";

// The registry logs every call through Prisma; in tests there is no database.
vi.mock("@/lib/db", () => ({
  db: {
    agentApiCall: { create: vi.fn().mockResolvedValue({}) },
    apiKey: { update: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock("@/lib/stats", () => ({ getBatchProjectStats: vi.fn().mockResolvedValue(new Map()) }));

import { toolCatalog, runTool, getTool, listTools } from "@/lib/agent-api";
import { defineTool, SCOPE_AGENT_READ, SCOPE_AGENT_WRITE } from "@/lib/agent-api/registry";
import { z } from "zod";

const readKey = { id: "k1", name: "read key", scopes: ["agent:read"], ip: null };
const writeKey = { id: "k2", name: "write key", scopes: ["agent:read", "agent:write"], ip: null };

beforeAll(() => {
  defineTool({
    name: "test_echo",
    description: "echo",
    scope: SCOPE_AGENT_READ,
    input: z.object({ text: z.string(), n: z.number().int().min(1).max(5).default(2) }),
    handler: async (a) => ({ text: a.text.repeat(a.n) }),
  });
  defineTool({
    name: "test_mutate",
    description: "mutate",
    scope: SCOPE_AGENT_WRITE,
    mutating: true,
    input: z.object({ value: z.string(), confirm: z.literal(true) }),
    handler: async (a) => ({ changed: a.value }),
  });
});

describe("agent API registry", () => {
  it("registers the production tool set", () => {
    const names = listTools().map((t) => t.name);
    for (const expected of [
      "platform_overview", "list_projects", "get_project", "project_backers", "campaign_performance", "category_breakdown", "project_updates",
      "find_user", "user_pledges", "backer_segments", "creator_pipeline",
      "email_engagement", "user_email_history", "email_campaigns", "newsletter_stats", "email_deliverability",
      "sentinel_errors", "sentinel_error_detail", "search_logs", "agent_call_log",
      "extend_campaign", "set_campaign_goal", "add_newsletter_subscribers", "create_email_campaign_draft",
    ]) {
      expect(names, `missing tool ${expected}`).toContain(expected);
    }
  });

  it("every mutating tool is write-scoped and requires confirm", () => {
    for (const t of listTools()) {
      if (!t.mutating) continue;
      expect(t.scope).toBe(SCOPE_AGENT_WRITE);
      const schema = z.toJSONSchema(t.input) as { properties?: Record<string, unknown>; required?: string[] };
      expect(schema.properties?.confirm, `${t.name} lacks confirm`).toBeDefined();
      expect(schema.required, `${t.name} confirm must be required`).toContain("confirm");
    }
  });

  it("produces JSON Schema for every tool", () => {
    const catalog = toolCatalog();
    expect(catalog.length).toBeGreaterThan(20);
    for (const entry of catalog) {
      expect(entry.inputSchema.type).toBe("object");
      if (!entry.name.startsWith("test_")) expect(entry.description.length, `${entry.name} description`).toBeGreaterThan(40);
    }
    const echo = catalog.find((c) => c.name === "test_echo")!;
    const props = echo.inputSchema.properties as Record<string, { type?: string; default?: unknown }>;
    expect(props.text.type).toBe("string");
    expect(props.n.default).toBe(2);
    if (process.env.AGENT_CATALOG_OUT) {
      writeFileSync(process.env.AGENT_CATALOG_OUT, JSON.stringify(catalog.filter((c) => !c.name.startsWith("test_")), null, 2));
    }
  });

  it("runs a tool with defaults applied", async () => {
    const res = await runTool("test_echo", { text: "ab" }, { key: readKey });
    expect(res).toMatchObject({ ok: true, result: { text: "abab" } });
  });

  it("rejects bad arguments with field-level details", async () => {
    const res = await runTool("test_echo", { text: 5, n: 99 }, { key: readKey });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.code).toBe("invalid_arguments");
      const paths = (res.details as { path: string }[]).map((d) => d.path);
      expect(paths).toContain("text");
      expect(paths).toContain("n");
    }
  });

  it("refuses unknown tools", async () => {
    const res = await runTool("nope", {}, { key: readKey });
    expect(res).toMatchObject({ ok: false, status: 404, code: "unknown_tool" });
  });

  it("enforces scope: a read key cannot call a write tool", async () => {
    const res = await runTool("test_mutate", { value: "x", confirm: true }, { key: readKey });
    expect(res).toMatchObject({ ok: false, status: 403, code: "insufficient_scope" });
  });

  it("requires confirm on mutating tools even with a write key", async () => {
    const without = await runTool("test_mutate", { value: "x" }, { key: writeKey });
    expect(without.ok).toBe(false);
    if (!without.ok) expect(["confirmation_required", "invalid_arguments"]).toContain(without.code);
    const withConfirm = await runTool("test_mutate", { value: "x", confirm: true }, { key: writeKey });
    expect(withConfirm).toMatchObject({ ok: true, result: { changed: "x" } });
  });

  it("write scope implies read", async () => {
    const res = await runTool("test_echo", { text: "z" }, { key: writeKey });
    expect(res.ok).toBe(true);
    expect(getTool("test_echo")).toBeDefined();
  });
});
