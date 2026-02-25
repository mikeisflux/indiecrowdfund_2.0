import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const reason = req.nextUrl.searchParams.get("reason") || "Forbidden";
  const status = parseInt(req.nextUrl.searchParams.get("status") || "400", 10);
  return NextResponse.json({ error: reason }, { status });
}

export async function POST(req: NextRequest) {
  const reason = req.nextUrl.searchParams.get("reason") || "Forbidden";
  const status = parseInt(req.nextUrl.searchParams.get("status") || "400", 10);
  return NextResponse.json({ error: reason }, { status });
}
