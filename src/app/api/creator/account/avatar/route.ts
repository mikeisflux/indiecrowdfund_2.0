import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorAccountAvatarLogger = logger.child({ module: "creator-account-avatar" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    // For now, convert to base64 data URL (in production, use cloud storage)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Update user's avatar
    await db.user.update({
      where: { id: session.user.id },
      data: { image: dataUrl },
    });

    return NextResponse.json({ success: true, avatarUrl: dataUrl });
  } catch (error) {
    creatorAccountAvatarLogger.error({ err: String(error) }, "Avatar upload error:");
    return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
  }
}
