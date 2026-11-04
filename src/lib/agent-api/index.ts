/**
 * Agent API: the HTTP surface the NAS-hosted MCP server wraps so Claude can
 * read platform data and run a few guarded writes.
 *
 *   GET  /api/agent/v1              who am I, scopes, tool count
 *   GET  /api/agent/v1/tools        catalog with JSON Schema per tool
 *   POST /api/agent/v1/tools/:name  run one tool, body = its arguments
 *
 * Importing this module registers every tool. Routes import it so the
 * registry is populated before the first request.
 */
import "./tools/projects";
import "./tools/people";
import "./tools/email";
import "./tools/ops";
import "./tools/writes";

export { toolCatalog, runTool, listTools, getTool } from "./registry";
export { authenticateAgentRequest, SCOPE_AGENT_READ, SCOPE_AGENT_WRITE } from "./auth";
export const AGENT_API_VERSION = "1.0";
