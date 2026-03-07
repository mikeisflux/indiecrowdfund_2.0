import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const chatAdminDeleteLogger = logger.child({ module: "chat-admin-delete" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// DELETE - Delete a chat message (admin/super_admin only)
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
    const messageId = searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 }
      );
    }

    // Find the message
    const message = await db.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    // Soft delete the message
    await db.chatMessage.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        deletedById: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Message deleted",
    });
  } catch (error) {
    chatAdminDeleteLogger.error({ err: String(error) }, "Error deleting chat message:");
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
