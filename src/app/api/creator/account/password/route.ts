import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorAccountPasswordLogger = logger.child({ module: "creator-account-password" });
import { auth, BCRYPT_COST } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Get user with password hash
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user?.password) {
      // User might be using OAuth only
      return NextResponse.json(
        { error: "Password not set. You may be using social login." },
        { status: 400 }
      );
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COST);

    // Update password
    await db.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorAccountPasswordLogger.error({ err: String(error) }, "Password update error:");
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}
