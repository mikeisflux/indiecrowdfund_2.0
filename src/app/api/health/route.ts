import { NextResponse } from "next/server";

// Simple health check endpoint for maintenance page to poll
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
