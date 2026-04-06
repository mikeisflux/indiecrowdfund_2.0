import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorAccountProfileLogger = logger.child({ module: "creator-account-profile" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Note: email changes must go through /api/user/settings/email which requires password verification
    await db.user.update({
      where: { id: session.user.id },
      data: {
        name: name.trim(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorAccountProfileLogger.error({ err: String(error) }, "Profile update error:");
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
