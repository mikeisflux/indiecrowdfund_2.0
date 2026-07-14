import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getR2Storage } from "@/lib/r2";

const log = logger.child({ module: "backer-digital-files-download" });

export const dynamic = "force-dynamic";

// GET /api/backer/digital-files/download?fileId=xxx
//
// Same-origin, Range-capable streaming download for digital rewards.
// The presigned-URL path (POST /api/backer/digital-files) hands the
// browser a cross-origin r2.cloudflarestorage.com URL and downloads the
// whole object in a single shot — which fails/corrupts for very large
// files on consumer networks (the same reason multipart UPLOAD is proxied
// through our own origin). This endpoint serves the object from our
// origin and honors HTTP Range + Content-Disposition: attachment, so the
// browser's NATIVE downloader streams it straight to disk (the Files app on
// iOS Safari) without holding it in memory, and can resume. This is what the
// backer download button links to.
//
// Memory stays bounded: bytes are pulled from R2 in small internal
// windows and streamed straight through — the whole file is never
// buffered server-side.
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

    const file = await db.digitalFile.findUnique({ where: { id: fileId } });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Access: an active pledge on the file's project (PENDING = campaign
    // backer, COMPLETED = charged/funded).
    const pledge = await db.pledge.findFirst({
      where: {
        userId: session.user.id,
        deletedAt: null,
        projectId: file.projectId,
        status: { in: ["PENDING", "COMPLETED"] },
      },
      include: { addons: { select: { addonId: true } } },
    });
    if (!pledge) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // File-level access control — mirrors the stream route.
    let hasAccess = false;
    const explicitDistribution = await db.digitalDistribution.findUnique({
      where: {
        digitalFileId_pledgeId: { digitalFileId: file.id, pledgeId: pledge.id },
      },
    });
    if (explicitDistribution?.distributedAt) {
      hasAccess = true;
    } else if (file.accessType === "ALL_BACKERS") {
      hasAccess = true;
    } else {
      const fileRewardIds = (file.rewardIds as string[]) || [];
      const fileAddonIds = (file.addonIds as string[]) || [];
      const pledgeAddonIds = pledge.addons.map((a: { addonId: string }) => a.addonId);
      if (fileRewardIds.length === 0 && fileAddonIds.length === 0) {
        hasAccess = false;
      } else {
        const rewardMatch =
          fileRewardIds.length > 0 && pledge.rewardId !== null && fileRewardIds.includes(pledge.rewardId);
        const addonMatch =
          fileAddonIds.length > 0 && fileAddonIds.some((id: string) => pledgeAddonIds.includes(id));
        hasAccess = rewardMatch || addonMatch;
      }
    }
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!file.r2StorageKey) {
      return NextResponse.json(
        { error: "This file is not available for streaming download." },
        { status: 409 }
      );
    }

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    // Trust the object's real size, not the DB record, for range math.
    const meta = await r2.getFileMetadata(file.r2StorageKey);
    if (!meta || meta.size <= 0) {
      return NextResponse.json({ error: "File content unavailable" }, { status: 404 });
    }
    const totalSize = meta.size;

    // Parse an optional Range header: "bytes=start-end".
    const rangeHeader = request.headers.get("range");
    let start = 0;
    let end = totalSize - 1;
    let isPartial = false;
    if (rangeHeader) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if (!m || (m[1] === "" && m[2] === "")) {
        return NextResponse.json({ error: "Invalid Range" }, {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        });
      }
      if (m[1] === "") {
        // suffix range: last N bytes
        const suffix = Number(m[2]);
        start = Math.max(0, totalSize - suffix);
        end = totalSize - 1;
      } else {
        start = Number(m[1]);
        end = m[2] === "" ? totalSize - 1 : Math.min(Number(m[2]), totalSize - 1);
      }
      if (start > end || start >= totalSize) {
        return NextResponse.json({ error: "Range Not Satisfiable" }, {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        });
      }
      isPartial = true;
    }

    const key = file.r2StorageKey;
    const WINDOW = 8 * 1024 * 1024; // pull 8MB from R2 at a time — bounds memory
    let pos = start;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (pos > end) {
          controller.close();
          return;
        }
        const chunkEnd = Math.min(pos + WINDOW - 1, end);
        const buf = await r2.getFileRange(key, pos, chunkEnd);
        if (!buf) {
          controller.error(new Error("Failed to read object range from storage"));
          return;
        }
        controller.enqueue(new Uint8Array(buf));
        pos = chunkEnd + 1;
      },
    });

    const safeName = (file.fileName || "download").replace(/["\\\r\n]/g, "");
    const headers: Record<string, string> = {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": (end - start + 1).toString(),
      "Accept-Ranges": "bytes",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    };
    if (isPartial) {
      headers["Content-Range"] = `bytes ${start}-${end}/${totalSize}`;
    }

    return new NextResponse(stream, { status: isPartial ? 206 : 200, headers });
  } catch (error) {
    log.error({ err: formatError(error) }, "digital file download error");
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
