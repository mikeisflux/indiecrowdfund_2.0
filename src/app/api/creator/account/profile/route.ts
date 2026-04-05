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
    const { name, email: rawEmail } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const email = rawEmail?.toLowerCase().trim();

    // Check if email is being changed and if it's already taken
    if (email && email !== session.user.email?.toLowerCase()) {
      const existingUser = await db.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
      });

      if (existingUser && existingUser.id !== session.user.id) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 });
      }
    }

    // Update user profile
    await db.user.update({
      where: { id: session.user.id },
      data: {
        name: name.trim(),
        ...(email && { email }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorAccountProfileLogger.error({ err: String(error) }, "Profile update error:");
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
