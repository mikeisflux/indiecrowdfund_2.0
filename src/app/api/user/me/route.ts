import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/auth/session";

// GET /api/user/me - Get current user info
export async function GET() {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        image: true,
        vanityUrl: true,
        emailVerified: true,
      },
    });

    return NextResponse.json({ user, vanityUrl: user?.vanityUrl || null });
  } catch (error) {
    console.error("Error fetching current user:", error);
    return NextResponse.json({ user: null });
  }
}
