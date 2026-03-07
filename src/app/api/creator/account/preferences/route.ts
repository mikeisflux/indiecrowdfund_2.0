import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorAccountPreferencesLogger = logger.child({ module: "creator-account-preferences" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    return NextResponse.json({
      preferences: user?.preferences || {
        notifications: {
          surveyCompleted: true,
          dailySummary: true,
          eachOrder: false,
          paymentFailed: true,
          productUpdates: true,
        },
      },
    });
  } catch (error) {
    creatorAccountPreferencesLogger.error({ err: String(error) }, "Preferences GET error:");
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { notifications } = body;

    // Get current preferences
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const currentPrefs = (user?.preferences as Record<string, unknown>) || {};

    // Update preferences
    await db.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...currentPrefs,
          notifications,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorAccountPreferencesLogger.error({ err: String(error) }, "Preferences update error:");
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
