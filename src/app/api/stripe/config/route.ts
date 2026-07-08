import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || "";

  if (!publishableKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  return NextResponse.json({ publishableKey });
}
