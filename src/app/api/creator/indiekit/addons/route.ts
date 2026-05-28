import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitAddonsLogger = logger.child({ module: "creator-indiekit-addons" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify user has access to this project before returning addons
    const project = await verifyProjectAccess(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Get addons linked to the survey (showInSurvey = true)
    const addons = await db.reward.findMany({
      where: {
        projectId,
        type: "ADDON",
        showInSurvey: true,
      },
      orderBy: { amount: "asc" },
    });

    return NextResponse.json({ addons });
  } catch (error) {
    creatorIndiekitAddonsLogger.error({ err: formatError(error) }, "Addons GET error:");
    return NextResponse.json({ error: "Failed to fetch addons" }, { status: 500 });
  }
}

// Helper to verify project access
async function verifyProjectAccess(projectId: string, userId: string) {
  return db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      OR: [
        { creatorId: userId },
        { collaborators: { some: { userId, status: "ACCEPTED" } } },
      ],
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action, addonId, addonIds, title, description, amount, quantityAvailable } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    const project = await verifyProjectAccess(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Create a new addon and auto-link to survey
    if (action === "create") {
      const addon = await db.reward.create({
        data: {
          projectId,
          type: "ADDON",
          title: title || "New Add-on",
          description: description || "",
          amount: amount || 0,
          quantityAvailable,
          shippingType: "NO_SHIPPING",
          shippingCountries: [],
          showInSurvey: true,
        },
      });

      return NextResponse.json({ addon });
    }

    // Update an existing addon
    if (action === "update" && addonId) {
      const addon = await db.reward.update({
        where: { id: addonId },
        data: {
          title,
          description,
          amount,
          quantityAvailable,
        },
      });

      return NextResponse.json({ addon });
    }

    // Link existing addon(s) to the survey
    if (action === "link" && addonIds?.length) {
      const result = await db.reward.updateMany({
        where: {
          id: { in: addonIds },
          projectId,
          type: "ADDON",
        },
        data: { showInSurvey: true },
      });

      return NextResponse.json({ success: true, linked: result.count });
    }

    // Unlink a single addon from the survey
    if (action === "unlink" && addonId) {
      await db.reward.update({
        where: { id: addonId },
        data: { showInSurvey: false },
      });

      return NextResponse.json({ success: true });
    }

    // Unlink all addons from the survey
    if (action === "unlink-all") {
      const result = await db.reward.updateMany({
        where: { projectId, type: "ADDON", showInSurvey: true },
        data: { showInSurvey: false },
      });

      return NextResponse.json({ success: true, unlinked: result.count });
    }

    if (action === "activate" && addonId) {
      const addon = await db.reward.update({
        where: { id: addonId },
        data: { isEnded: false, endedAt: null },
      });

      return NextResponse.json({ addon });
    }

    if (action === "deactivate" && addonId) {
      const addon = await db.reward.update({
        where: { id: addonId },
        data: { isEnded: true, endedAt: new Date() },
      });

      return NextResponse.json({ addon });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    creatorIndiekitAddonsLogger.error({ err: formatError(error) }, "Addons POST error:");
    return NextResponse.json({ error: "Failed to process addon request" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const addonId = searchParams.get("addonId");

    if (!projectId || !addonId) {
      return NextResponse.json({ error: "Project ID and Addon ID required" }, { status: 400 });
    }

    const project = await verifyProjectAccess(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Unlink from survey (same as POST unlink)
    await db.reward.update({
      where: { id: addonId },
      data: { showInSurvey: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorIndiekitAddonsLogger.error({ err: formatError(error) }, "Addons DELETE error:");
    return NextResponse.json({ error: "Failed to delete addon" }, { status: 500 });
  }
}
