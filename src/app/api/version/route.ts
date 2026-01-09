import { NextResponse } from "next/server";

// This is set at build time
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || process.env.BUILD_ID || "development";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    buildId: BUILD_ID,
    timestamp: Date.now()
  });
}
