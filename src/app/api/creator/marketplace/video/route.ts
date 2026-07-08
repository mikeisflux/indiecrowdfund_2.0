import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const videoFilesLogger = logger.child({ module: "creator-marketplace-video" });
import { auth } from "@/lib/auth";
import { getR2Storage } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * GET /api/creator/marketplace/video
 *
 * List user's uploaded video files from R2
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const prefix = `marketplace/${session.user.id}/video/`;
    const files = await r2.listFiles(prefix);

    const formatted = files.map((f) => {
      const keyParts = f.key.split("/");
      const fullFilename = keyParts[keyParts.length - 1];
      const underscoreIdx = fullFilename.indexOf("_");
      const fileId = underscoreIdx > 0 ? fullFilename.substring(0, underscoreIdx) : fullFilename;
      const name = underscoreIdx > 0 ? fullFilename.substring(underscoreIdx + 1) : fullFilename;

      const formatSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      };

      return {
        id: fileId,
        key: f.key,
        name,
        size: f.size,
        sizeFormatted: formatSize(f.size),
        uploadedAt: f.lastModified?.toISOString() || null,
      };
    });

    return NextResponse.json({ files: formatted });
  } catch (error) {
    videoFilesLogger.error({ err: formatError(error) }, "Error listing video files");
    return NextResponse.json({ error: "Failed to list video files" }, { status: 500 });
  }
}

/**
 * DELETE /api/creator/marketplace/video?key=...
 *
 * Delete a video file from R2
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "File key is required" }, { status: 400 });
    }

    if (!key.startsWith(`marketplace/${session.user.id}/video/`)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    await r2.deleteFile(key);

    return NextResponse.json({ success: true });
  } catch (error) {
    videoFilesLogger.error({ err: formatError(error) }, "Error deleting video file");
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
