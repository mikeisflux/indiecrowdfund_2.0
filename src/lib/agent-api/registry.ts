import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { SCOPE_AGENT_READ, SCOPE_AGENT_WRITE, keyHasScope, type AgentKey, type AgentScope } from "./auth";

const log = logger.child({ module: "agent-api" });

/**
 * Tool registry for the Agent API.
 *
 * Each tool is a name, a description written for the model that will call
 * it, a zod input schema, a scope, and a handler. The catalog endpoint turns
 * the zod schema into JSON Schema so the MCP server on the NAS can register
 * every tool without hand-copying argument lists — add a tool here and it
 * shows up there on its next restart.
 *
 * Mutating tools must declare `mutating: true`. Their schema is required to
 * include `confirm: z.literal(true)` so a model cannot change anything by
 * accident: the call fails with a clear message until confirm is sent.
 */

export interface ToolContext {
  key: AgentKey;
}

export interface AgentTool<I extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  scope: AgentScope;
  mutating?: boolean;
  input: I;
  handler: (args: z.infer<I>, ctx: ToolContext) => Promise<unknown>;
}

const registry = new Map<string, AgentTool>();

export function defineTool<I extends z.ZodType>(tool: AgentTool<I>): AgentTool<I> {
  if (!/^[a-z][a-z0-9_]{2,60}$/.test(tool.name)) {
    throw new Error(`Agent tool name must be snake_case: ${tool.name}`);
  }
  if (tool.mutating && tool.scope !== SCOPE_AGENT_WRITE) {
    throw new Error(`Mutating tool ${tool.name} must use the ${SCOPE_AGENT_WRITE} scope`);
  }
  if (registry.has(tool.name)) throw new Error(`Duplicate agent tool: ${tool.name}`);
  registry.set(tool.name, tool as unknown as AgentTool);
  return tool;
}

export function listTools(): AgentTool[] {
  return [...registry.values()];
}

export function getTool(name: string): AgentTool | undefined {
  return registry.get(name);
}

export interface CatalogEntry {
  name: string;
  description: string;
  scope: AgentScope;
  mutating: boolean;
  inputSchema: Record<string, unknown>;
}

export function toolCatalog(): CatalogEntry[] {
  return listTools().map((t) => ({
    name: t.name,
    description: t.description,
    scope: t.scope,
    mutating: !!t.mutating,
    inputSchema: inputJsonSchema(t.input),
  }));
}

/**
 * zod marks a field with a default as required in the OUTPUT type, so its
 * JSON Schema lists `limit` and friends under `required`. A model reading
 * that would think it has to send every one. Strip defaulted fields from
 * `required`: the server fills them in.
 */
function inputJsonSchema(input: z.ZodType): Record<string, unknown> {
  const schema = z.toJSONSchema(input, { target: "draft-7", unrepresentable: "any" }) as Record<string, unknown>;
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  if (Array.isArray(schema.required)) {
    schema.required = (schema.required as string[]).filter((k) => props[k]?.default === undefined);
    if ((schema.required as string[]).length === 0) delete schema.required;
  }
  delete schema.$schema;
  return schema;
}

export type RunResult =
  | { ok: true; status: 200; result: unknown }
  | { ok: false; status: 400 | 403 | 404 | 500; code: string; error: string; details?: unknown };

/** Anything that looks like a credential never lands in the call log. */
function redactArgs(args: unknown): unknown {
  if (!args || typeof args !== "object") return args;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
    out[k] = /secret|password|token|apikey|api_key/i.test(k) ? "[redacted]" : v;
  }
  return out;
}

export async function runTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<RunResult> {
  const started = Date.now();
  const tool = registry.get(name);

  const finish = async (res: RunResult): Promise<RunResult> => {
    const durationMs = Date.now() - started;
    let resultSize: number | null = null;
    if (res.ok) {
      try {
        resultSize = Buffer.byteLength(JSON.stringify(res.result));
      } catch {
        resultSize = null;
      }
    }
    // Internal callers (the support chatbot) have no ApiKey row; their
    // calls are logged with the caller name in place of a key.
    const isInternal = ctx.key.id.startsWith("internal:");
    void db.agentApiCall
      .create({
        data: {
          apiKeyId: isInternal ? null : ctx.key.id,
          tool: name,
          args: { ...(redactArgs(rawArgs) as object), ...(isInternal ? { _caller: ctx.key.name } : {}) },
          ok: res.ok,
          statusCode: res.status,
          durationMs,
          error: res.ok ? null : res.error.slice(0, 1000),
          resultSize,
          ip: ctx.key.ip,
        },
      })
      .catch((err: unknown) => log.warn({ err: formatError(err) }, "agent call log write failed"));
    return res;
  };

  if (!tool) return finish({ ok: false, status: 404, code: "unknown_tool", error: `No tool named "${name}". GET /api/agent/v1/tools lists them.` });

  if (!keyHasScope(ctx.key, tool.scope)) {
    return finish({ ok: false, status: 403, code: "insufficient_scope", error: `Tool "${name}" needs the ${tool.scope} scope; this key has ${ctx.key.scopes.join(", ") || "none"}.` });
  }

  const parsed = tool.input.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return finish({
      ok: false,
      status: 400,
      code: "invalid_arguments",
      error: `Invalid arguments for "${name}".`,
      details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  if (tool.mutating && (parsed.data as { confirm?: unknown }).confirm !== true) {
    return finish({ ok: false, status: 400, code: "confirmation_required", error: `"${name}" changes data. Re-send with confirm: true once the user has approved it.` });
  }

  try {
    const result = await tool.handler(parsed.data, ctx);
    return finish({ ok: true, status: 200, result });
  } catch (err) {
    // A ToolError is the tool refusing or rejecting the call on purpose
    // (bad SQL, unknown id, invalid arguments): the caller gets the
    // message and fixes their request. Only unexpected failures page.
    if (err instanceof ToolError) {
      log.warn({ err: err.message, code: err.code, tool: name, keyId: ctx.key.id }, `agent tool ${name} rejected the call`);
    } else {
      log.error({ err: formatError(err), tool: name, keyId: ctx.key.id }, `agent tool ${name} failed`);
    }
    const message = err instanceof ToolError ? err.message : "The tool failed while running. The error has been logged.";
    return finish({ ok: false, status: err instanceof ToolError ? err.status : 500, code: err instanceof ToolError ? err.code : "tool_error", error: message });
  }
}

/** Throw from a handler to send the caller a specific, safe message. */
export class ToolError extends Error {
  constructor(
    message: string,
    public code: string = "tool_error",
    public status: 400 | 404 = 400
  ) {
    super(message);
  }
}

export { SCOPE_AGENT_READ, SCOPE_AGENT_WRITE };
