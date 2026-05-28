import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitSettingsImageLogger = logger.child({ module: "creator-indiekit-settings-image" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, imageUrl } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Update project image
    await db.project.update({
      where: { id: projectId },
      data: { imageUrl },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorIndiekitSettingsImageLogger.error({ err: formatError(error) }, "Settings image API error:");
    return NextResponse.json({ error: "Failed to update image" }, { status: 500 });
  }
}
