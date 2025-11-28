import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await validateSession();

    if (!session) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json({ user: null });
  }
}
