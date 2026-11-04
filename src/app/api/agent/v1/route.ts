import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest, listTools, AGENT_API_VERSION } from "@/lib/agent-api";

export const dynamic = "force-dynamic";

/** Identity check: confirms the credentials work and what they can do. */
export async function GET(req: NextRequest) {
  const auth = await authenticateAgentRequest(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    ok: true,
    version: AGENT_API_VERSION,
    key: { name: auth.key.name, scopes: auth.key.scopes },
    tools: listTools().length,
    catalog: "/api/agent/v1/tools",
  });
}
