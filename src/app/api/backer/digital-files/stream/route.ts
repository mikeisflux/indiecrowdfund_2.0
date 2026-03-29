import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getR2Storage } from "@/lib/r2";

const streamLogger = logger.child({ module: "backer-digital-files-stream" });

/**
 * GET /api/backer/digital-files/stream?fileId=xxx
 *
 * Proxies PDF content from R2 through the server to avoid CORS issues
 * when rendering thumbnails client-side.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    }

    const file = await db.digitalFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Verify access: user must have a COMPLETED pledge for this project
    const pledge = await db.pledge.findFirst({
      where: {
        userId: session.user.id,
        projectId: file.projectId,
        status: "COMPLETED",
        deletedAt: null,
      },
      include: {
        addons: { select: { addonId: true } },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Check access control for the specific file
    let hasAccess = false;
    const explicitDistribution = await db.digitalDistribution.findUnique({
      where: {
        digitalFileId_pledgeId: {
          digitalFileId: file.id,
          pledgeId: pledge.id,
        },
      },
    });

    if (explicitDistribution?.distributedAt) {
      hasAccess = true;
    } else {
      switch (file.accessType) {
        case "ALL_BACKERS":
          hasAccess = true;
          break;
        case "SPECIFIC_REWARDS":
          hasAccess = pledge.rewardId !== null && file.rewardIds.includes(pledge.rewardId);
          break;
        case "SPECIFIC_ADDONS": {
          const pledgeAddonIds = pledge.addons.map((a: { addonId: string }) => a.addonId);
          hasAccess = file.addonIds.some((id: string) => pledgeAddonIds.includes(id));
          break;
        }
        case "REWARD_AND_ADDON": {
          const hasReward = pledge.rewardId !== null && file.rewardIds.includes(pledge.rewardId);
          const pledgeAddons = pledge.addons.map((a: { addonId: string }) => a.addonId);
          const hasAddon = file.addonIds.some((id: string) => pledgeAddons.includes(id));
          hasAccess = hasReward || hasAddon;
          break;
        }
        default:
          hasAccess = true;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get file content
    let content: Buffer | null = null;

    if (file.r2StorageKey) {
      const r2 = await getR2Storage();
      if (!r2) {
        return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
      }
      content = await r2.getFile(file.r2StorageKey);
    } else if (file.fileUrl) {
      // Legacy: fetch from direct URL
      const response = await fetch(file.fileUrl);
      if (!response.ok) {
        return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });
      }
      const arrayBuffer = await response.arrayBuffer();
      content = Buffer.from(arrayBuffer);
    }

    if (!content) {
      return NextResponse.json({ error: "File content unavailable" }, { status: 404 });
    }

    return new NextResponse(content, {
      headers: {
        "Content-Type": file.mimeType || "application/pdf",
        "Content-Length": content.length.toString(),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    streamLogger.error({ err: String(error) }, "PDF stream error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
