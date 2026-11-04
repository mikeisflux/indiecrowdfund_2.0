import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest, runTool } from "@/lib/agent-api";
import { checkRateLimit, rateLimitHeaders } from "@/lib/api/respond";

export const dynamic = "force-dynamic";
// Most tools answer in seconds. run_ai_service (the daily automation) and a
// full-audience send_email_campaign can run for minutes; the AI run route
// itself allows 300.
export const maxDuration = 300;

/**
 * Run one tool. Body is the tool's arguments as a JSON object; the response
 * is { ok: true, result } or { ok: false, error: { code, message, details } }.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const auth = await authenticateAgentRequest(req);
  if (!auth.ok) return auth.response;

  const rate = checkRateLimit(`agent:${auth.key.id}`);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: { code: "rate_limited", message: "Rate limit exceeded. Try again shortly." } }, { status: 429, headers: rateLimitHeaders(rate) });
  }

  const { name } = await params;
  let args: unknown = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      args = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, error: { code: "invalid_json", message: "Request body must be a JSON object of tool arguments." } }, { status: 400 });
    }
  }
  if (args !== null && typeof args !== "object") {
    return NextResponse.json({ ok: false, error: { code: "invalid_json", message: "Request body must be a JSON object." } }, { status: 400 });
  }

  const res = await runTool(name, args ?? {}, { key: auth.key });
  if (res.ok) {
    return NextResponse.json({ ok: true, tool: name, result: res.result }, { headers: rateLimitHeaders(rate) });
  }
  return NextResponse.json(
    { ok: false, tool: name, error: { code: res.code, message: res.error, ...(res.details ? { details: res.details } : {}) } },
    { status: res.status, headers: rateLimitHeaders(rate) }
  );
}
