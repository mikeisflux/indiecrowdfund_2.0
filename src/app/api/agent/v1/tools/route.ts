import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest, toolCatalog, AGENT_API_VERSION } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

/**
 * Tool catalog. The MCP server fetches this on startup and registers one MCP
 * tool per entry, so the two sides never drift: a tool added here is
 * callable from Claude after the server's next restart.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateAgentRequest(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ version: AGENT_API_VERSION, tools: toolCatalog() });
}
