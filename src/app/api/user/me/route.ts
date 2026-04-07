import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const userMeLogger = logger.child({ module: "user-me" });
import { db } from "@/lib/db";
import { validateSession } from "@/lib/auth/session";

// GET /api/user/me - Get current user info
export async function GET() {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
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
    userMeLogger.error({ err: String(error) }, "Error fetching current user:");
    return NextResponse.json({ user: null });
  }
}
