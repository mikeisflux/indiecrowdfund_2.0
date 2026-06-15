import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getR2Storage, generateFileKey } from "@/lib/r2";

const multipartLogger = logger.child({ module: "creator-digital-files-multipart" });

// Multipart upload coordinator for digital files. Single-PUT uploads
// of large files (typically >100MB) fail unpredictably on consumer
// networks: idle CGNAT/router killing the TCP, browser memory pressure
// on the File body, mid-stream proxy resets. Multipart splits the file
// into ~10MB-100MB parts -- each part is its own short presigned PUT,
// the client collects the per-part ETag, then calls /complete which
// stitches them server-side via R2's CompleteMultipartUpload.
//
// One route, four actions to keep auth + ownership checks in one
// place:
//   - init      → create DigitalFile row + R2 multipart upload
//                 returns { fileId, key, uploadId }
//   - sign-part → presigned URL for one part number
//                 returns { url }
//   - complete  → finalize with the list of ETags
//                 returns { file }
//   - abort     → drop the partial upload + DB row
//                 returns { success }

async function verifyFileAccess(fileId: string, userId: string) {
  const file = await db.digitalFile.findUnique({
    where: { id: fileId },
    include: {
      project: {
        select: {
          id: true,
          creatorId: true,
          collaborators: {
            where: { status: "ACCEPTED" },
            select: { userId: true },
          },
        },
      },
    },
  });
  if (!file) return null;
  const isOwner = file.project.creatorId === userId;
  const isCollab = file.project.collaborators.some((c: { userId: string }) => c.userId === userId);
  if (!isOwner && !isCollab) return null;
  return file;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    if (action === "init") {
      const {
        projectId,
        fileName,
        fileSize,
        mimeType,
        name,
        description,
        accessType,
        rewardIds,
        addonIds,
      } = body;

      if (!projectId || !fileName || !fileSize) {
        return NextResponse.json(
          { error: "Missing required fields: projectId, fileName, fileSize" },
          { status: 400 }
        );
      }

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
        return NextResponse.json(
          { error: "Project not found or access denied" },
          { status: 404 }
        );
      }

      const settings = await db.platformSettings.findFirst({
        select: {
          r2Enabled: true,
          digitalDownloadsEnabled: true,
          maxProjectStorageMB: true,
          allowedFileTypes: true,
        },
      });
      if (!settings?.r2Enabled || !settings?.digitalDownloadsEnabled) {
        return NextResponse.json(
          { error: "Digital downloads are not enabled" },
          { status: 400 }
        );
      }

      const DIGITAL_FILE_MAX_MB = 2048;
      if (fileSize > DIGITAL_FILE_MAX_MB * 1024 * 1024) {
        return NextResponse.json(
          { error: `File size exceeds maximum of ${DIGITAL_FILE_MAX_MB}MB` },
          { status: 400 }
        );
      }

      const allowedTypes = (settings.allowedFileTypes || "pdf,epub,zip,mp3")
        .split(",")
        .map((t: string) => t.trim());
      const fileExt = fileName.split(".").pop()?.toLowerCase();
      if (!fileExt || !allowedTypes.includes(fileExt)) {
        return NextResponse.json(
          { error: `File type not allowed. Allowed: ${allowedTypes.join(", ")}` },
          { status: 400 }
        );
      }

      const currentUsage = await r2.getProjectStorageUsed(projectId);
      const maxProjectBytes = (settings.maxProjectStorageMB || 10240) * 1024 * 1024;
      if (currentUsage + fileSize > maxProjectBytes) {
        return NextResponse.json(
          { error: `Project storage limit exceeded (${settings.maxProjectStorageMB}MB max)` },
          { status: 400 }
        );
      }

      const fileId = crypto.randomUUID();
      const storageKey = generateFileKey(projectId, fileName, fileId);

      const { uploadId } = await r2.createMultipartUpload(storageKey, {
        metadata: { mimeType: mimeType || "application/octet-stream" },
      });

      const digitalFile = await db.digitalFile.create({
        data: {
          id: fileId,
          projectId,
          name: name || fileName,
          description,
          fileName,
          fileUrl: "",
          r2StorageKey: storageKey,
          fileSize,
          mimeType,
          accessType: accessType || "ALL_BACKERS",
          rewardIds: rewardIds || [],
          addonIds: addonIds || [],
          uploadedById: session.user.id,
        },
      });

      return NextResponse.json({
        fileId: digitalFile.id,
        key: storageKey,
        uploadId,
      });
    }

    if (action === "sign-part") {
      const { fileId, uploadId, partNumber } = body;
      if (!fileId || !uploadId || typeof partNumber !== "number") {
        return NextResponse.json(
          { error: "fileId, uploadId, and partNumber required" },
          { status: 400 }
        );
      }
      if (partNumber < 1 || partNumber > 10000) {
        return NextResponse.json(
          { error: "partNumber must be between 1 and 10000" },
          { status: 400 }
        );
      }

      const file = await verifyFileAccess(fileId, session.user.id);
      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      const url = await r2.getUploadPartUrl(
        file.r2StorageKey,
        uploadId,
        partNumber,
        7200
      );
      return NextResponse.json({ url });
    }

    if (action === "complete") {
      const { fileId, uploadId, parts } = body;
      if (!fileId || !uploadId || !Array.isArray(parts) || parts.length === 0) {
        return NextResponse.json(
          { error: "fileId, uploadId, and non-empty parts array required" },
          { status: 400 }
        );
      }

      const file = await verifyFileAccess(fileId, session.user.id);
      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      // Validate part shape so a malformed client doesn't drive us into
      // an R2 error mid-finalize.
      const cleanParts = parts.map((p: { partNumber: unknown; etag: unknown }) => {
        const pn = typeof p.partNumber === "number" ? p.partNumber : NaN;
        const et = typeof p.etag === "string" ? p.etag : "";
        if (!Number.isInteger(pn) || pn < 1 || !et) {
          throw new Error("Invalid part entry");
        }
        return { partNumber: pn, etag: et };
      });

      await r2.completeMultipartUpload(file.r2StorageKey, uploadId, cleanParts);

      // R2's CompleteMultipartUpload returns when the object is fully
      // assembled; mark the file ready by stamping updatedAt. The
      // single-PUT path doesn't have a "ready" flag either, so we
      // match its model.
      const updated = await db.digitalFile.update({
        where: { id: fileId },
        data: { updatedAt: new Date() },
      });

      return NextResponse.json({ file: updated });
    }

    if (action === "abort") {
      const { fileId, uploadId } = body;
      if (!fileId || !uploadId) {
        return NextResponse.json(
          { error: "fileId and uploadId required" },
          { status: 400 }
        );
      }

      const file = await verifyFileAccess(fileId, session.user.id);
      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      await r2.abortMultipartUpload(file.r2StorageKey, uploadId);
      await db.digitalFile.deleteMany({ where: { id: fileId } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    multipartLogger.error({ err: formatError(error) }, "Multipart upload error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Multipart upload failed" },
      { status: 500 }
    );
  }
}
