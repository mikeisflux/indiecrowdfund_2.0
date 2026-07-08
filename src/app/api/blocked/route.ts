import { NextRequest, NextResponse } from "next/server";

// Whitelist of valid HTTP status codes this endpoint may return
const ALLOWED_STATUSES = new Set([400, 401, 403, 404, 429]);

export async function GET(req: NextRequest) {
  const reason = req.nextUrl.searchParams.get("reason") || "Forbidden";
  const rawStatus = parseInt(req.nextUrl.searchParams.get("status") || "400", 10);
  const status = ALLOWED_STATUSES.has(rawStatus) ? rawStatus : 400;
  return NextResponse.json({ error: reason }, { status });
}

export async function POST(req: NextRequest) {
  const reason = req.nextUrl.searchParams.get("reason") || "Forbidden";
  const rawStatus = parseInt(req.nextUrl.searchParams.get("status") || "400", 10);
  const status = ALLOWED_STATUSES.has(rawStatus) ? rawStatus : 400;
  return NextResponse.json({ error: reason }, { status });
}
