import { NextRequest, NextResponse } from "next/server";
import { captureClientError } from "@/lib/error-tracker";
import { auth } from "@/lib/auth";

// POST /api/error-report — Client-side error reporting endpoint
// Rate limited by the error tracker itself
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, stack, url, metadata } = body;

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const session = await auth();
    const userAgent = req.headers.get("user-agent") || undefined;

    await captureClientError(
      message,
      stack,
      url || "unknown",
      userAgent || "unknown",
      session?.user?.id,
      metadata
    );

    return NextResponse.json({ ok: true });
  } catch {
    // Never fail the client on error tracking errors
    return NextResponse.json({ ok: true });
  }
}
