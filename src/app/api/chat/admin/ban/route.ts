import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const chatAdminBanLogger = logger.child({ module: "chat-admin-ban" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST - Ban a user from chat (admin/super_admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or super admin
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, reason } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check that target user exists
    const targetUser = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, name: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Prevent banning other admins
    if (targetUser.role === "ADMIN" || targetUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Cannot ban admin users" },
        { status: 400 }
      );
    }

    // Ban the user
    await db.user.update({
      where: { id: userId },
      data: {
        chatBannedAt: new Date(),
        chatBannedById: session.user.id,
        chatBanReason: reason || "Violated community guidelines",
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${targetUser.name || userId} has been banned from chat`,
    });
  } catch (error) {
    chatAdminBanLogger.error({ err: formatError(error) }, "Error banning user from chat:");
    return NextResponse.json(
      { error: "Failed to ban user" },
      { status: 500 }
    );
  }
}

// DELETE - Unban a user from chat (admin/super_admin only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or super admin
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Unban the user
    await db.user.update({
      where: { id: userId },
      data: {
        chatBannedAt: null,
        chatBannedById: null,
        chatBanReason: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "User has been unbanned from chat",
    });
  } catch (error) {
    chatAdminBanLogger.error({ err: formatError(error) }, "Error unbanning user from chat:");
    return NextResponse.json(
      { error: "Failed to unban user" },
      { status: 500 }
    );
  }
}
