import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/diagnostics/payment
 *
 * Lightweight endpoint for frontend payment flow to report diagnostic events.
 * These show up in PM2 logs for debugging payment issues (especially DC upcharges).
 * No auth required - just logs and returns ok.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, data } = body;

    // Structured log that shows in PM2
    console.log(
      `[PaymentDiag] ${event}`,
      JSON.stringify(data, null, 0)
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
