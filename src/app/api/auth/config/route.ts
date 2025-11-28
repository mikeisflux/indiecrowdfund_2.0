import { NextResponse } from "next/server";

// Returns public auth configuration
export async function GET() {
  return NextResponse.json({
    providers: {
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      credentials: true,
    },
  });
}
