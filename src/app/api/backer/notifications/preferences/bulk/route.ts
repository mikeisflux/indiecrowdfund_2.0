import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bulkPrefsLogger = logger.child({ module: "backer-notifications-preferences-bulk" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST: enable or disable ALL notification channels across every project the
// backer has backed. The "Enable All" / "Disable All" buttons in the backer
// dashboard's Notifications tab call this; previously it 404'd (no route).
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { action } = await request.json();
    if (action !== "enable_all" && action !== "disable_all") {
      return NextResponse.json(
        { error: "Invalid action — expected 'enable_all' or 'disable_all'" },
        { status: 400, headers: corsHeaders }
      );
    }
    const enabled = action === "enable_all";

    // Every project this user has actually backed (completed pledge).
    const pledges = await db.pledge.findMany({
      where: { userId: session.user.id, deletedAt: null, status: "COMPLETED" },
      select: { projectId: true },
      distinct: ["projectId"],
    });
    const projectIds = pledges.map((p: { projectId: string }) => p.projectId);

    let updated = 0;
    for (const projectId of projectIds) {
      await db.projectNotificationPreference.upsert({
        where: {
          userId_projectId: { userId: session.user.id, projectId },
        },
        create: {
          userId: session.user.id,
          projectId,
          updates: enabled,
          comments: enabled,
          surveys: enabled,
          shipping: enabled,
          messages: enabled,
          digestFrequency: "instant",
        },
        update: {
          updates: enabled,
          comments: enabled,
          surveys: enabled,
          shipping: enabled,
          messages: enabled,
        },
      });
      updated++;
    }

    return NextResponse.json({ updated, enabled }, { headers: corsHeaders });
  } catch (error) {
    bulkPrefsLogger.error({ err: formatError(error) }, "Error in bulk notification preferences:");
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500, headers: corsHeaders }
    );
  }
}
