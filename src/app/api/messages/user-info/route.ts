import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const messagesUserInfoLogger = logger.child({ module: "messages-user-info" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/messages/user-info?userId=xxx
 * Returns basic user info (name, image) for the messaging UI.
 * Requires authentication.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        image: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    messagesUserInfoLogger.error({ err: String(error) }, "Error fetching user info:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
