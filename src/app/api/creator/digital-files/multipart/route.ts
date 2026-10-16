import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getR2Storage, generateFileKey } from "@/lib/r2";
import { applyFileReplacement } from "@/lib/digital-files/replace";

const multipartLogger = logger.child({ module: "creator-digital-files-multipart" });

export const dynamic = "force-dynamic";
// A single part is ≤ 8MB from the browser and one UploadPart to R2; well
// under this, but the finalize step on a 2GB file can take a while.
export const maxDuration = 300;

// Multipart upload coordinator for digital files.
//
// The browser POSTs each chunk to this route (same-origin, so no
// browser → r2.cloudflarestorage.com path to break) and the server
// forwards it to R2 with UploadPart. Every accepted part's ETag is written
// to DigitalFile.uploadedParts, so an upload interrupted by a refresh, a
// dropped connection or a closed laptop resumes from the last good part
// instead of starting over — the dialog asks `find-pending` for the same
// file name + size and continues.
//
// The DigitalFile row exists from `init` with uploadStatus UPLOADING. It is
// invisible to backers and cannot be distributed until `complete` flips it
// to READY. Before this flag existed a refresh mid-upload left a row that
// looked uploaded with no object behind it.
//
// Actions (all POST, JSON body unless noted):
//   init          { projectId, fileName, fileSize, mimeType, name,
//                   replaceOfFileId? }
//                 → { fileId, key, uploadId, uploadedParts: {} }
//                 With replaceOfFileId the row is a hidden temporary carrier;
//                 `complete` moves its object onto that file and deletes it.
//   find-pending  { projectId, fileName, fileSize }
//                 → { found: true, fileId, uploadId, uploadedParts } | { found: false }
//   upload-part   raw bytes; ?action=upload-part&fileId&uploadId&partNumber
//                 → { etag }
//   status        { fileId } → { uploadStatus, uploadId, uploadedParts }
//   complete      { fileId, uploadId, parts } → { file }
//   abort         { fileId, uploadId } → { success }
//   sign-part     { fileId, uploadId, partNumber } → { url } (browser-direct;
//                 kept for tooling, the dialog doesn't use it)

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
  const isCollab = file.project.collaborators.some((c: { userId: string | null }) => c.userId === userId);
  if (!isOwner && !isCollab) return null;
  return file;
}

function partsRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v) out[k] = v;
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    // upload-part carries raw chunk bytes; its coordinates come in the
    // query string so the body is never JSON-parsed.
    const url = new URL(request.url);
    const queryAction = url.searchParams.get("action");

    if (queryAction === "upload-part") {
      const fileId = url.searchParams.get("fileId");
      const uploadId = url.searchParams.get("uploadId");
      const partNumberStr = url.searchParams.get("partNumber");
      const partNumber = partNumberStr ? Number(partNumberStr) : NaN;

      if (!fileId || !uploadId || !Number.isInteger(partNumber)) {
        return NextResponse.json(
          { error: "fileId, uploadId, partNumber required as query params" },
          { status: 400 }
        );
      }
      if (partNumber < 1 || partNumber > 10000) {
        return NextResponse.json({ error: "partNumber must be between 1 and 10000" }, { status: 400 });
      }

      const file = await verifyFileAccess(fileId, session.user.id);
      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      if (file.uploadStatus !== "UPLOADING" || file.multipartUploadId !== uploadId) {
        // Stale tab finishing an upload that was already completed, aborted
        // or restarted. 409 is permanent for the client: it re-syncs via
        // `status` instead of retrying the part.
        return NextResponse.json({ error: "This upload is no longer open" }, { status: 409 });
      }

      // Buffer the chunk (≤ 8MB by client convention). R2's UploadPart
      // needs Content-Length up front, which a streaming body can't give.
      const arrayBuffer = await request.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      if (buf.length === 0) {
        return NextResponse.json({ error: "Empty part" }, { status: 400 });
      }

      const { etag } = await r2.uploadPart(file.r2StorageKey as string, uploadId, partNumber, buf);

      // Record the part atomically (several parts are in flight at once).
      // Also bumps updatedAt, which is what the stale-upload cron watches.
      const patch = JSON.stringify({ [String(partNumber)]: etag });
      await db.$executeRaw`UPDATE "DigitalFile" SET "uploadedParts" = COALESCE("uploadedParts", '{}'::jsonb) || ${patch}::jsonb, "updatedAt" = NOW() WHERE id = ${fileId}`;

      return NextResponse.json({ etag });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "init") {
      const { projectId, fileName, fileSize, mimeType, name, description, accessType, rewardIds, addonIds } = body;
      const replaceOfFileId = typeof body.replaceOfFileId === "string" ? body.replaceOfFileId : null;

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
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
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
        return NextResponse.json({ error: "Digital downloads are not enabled" }, { status: 400 });
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

      let replacing: { id: string; fileSize: number } | null = null;
      if (replaceOfFileId) {
        const target = await db.digitalFile.findFirst({
          where: { id: replaceOfFileId, projectId },
          select: { id: true, fileSize: true },
        });
        if (!target) {
          return NextResponse.json({ error: "File to replace not found" }, { status: 404 });
        }
        replacing = target;
      }

      const currentUsage = await r2.getProjectStorageUsed(projectId);
      const maxProjectBytes = (settings.maxProjectStorageMB || 10240) * 1024 * 1024;
      // A replacement frees the old object, so only count the difference.
      if (currentUsage - (replacing?.fileSize ?? 0) + fileSize > maxProjectBytes) {
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
          uploadStatus: "UPLOADING",
          multipartUploadId: uploadId,
          uploadedParts: {},
          replacesFileId: replacing?.id ?? null,
        },
      });

      return NextResponse.json({ fileId: digitalFile.id, key: storageKey, uploadId, uploadedParts: {} });
    }

    if (action === "find-pending") {
      const { projectId, fileName, fileSize } = body;
      if (!projectId || !fileName || !fileSize) {
        return NextResponse.json({ found: false });
      }
      const pending = await db.digitalFile.findFirst({
        where: {
          projectId,
          fileName,
          fileSize: Number(fileSize),
          // A half-done replacement only resumes as that same replacement.
          replacesFileId: typeof body.replaceOfFileId === "string" ? body.replaceOfFileId : null,
          uploadStatus: "UPLOADING",
          multipartUploadId: { not: null },
          // Match the stale-upload cron's window; older ones get aborted.
          updatedAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, multipartUploadId: true, uploadedParts: true },
      });
      if (!pending || !(await verifyFileAccess(pending.id, session.user.id))) {
        return NextResponse.json({ found: false });
      }
      return NextResponse.json({
        found: true,
        fileId: pending.id,
        uploadId: pending.multipartUploadId,
        uploadedParts: partsRecord(pending.uploadedParts),
      });
    }

    if (action === "status") {
      const { fileId } = body;
      if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });
      const file = await verifyFileAccess(fileId, session.user.id);
      if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
      return NextResponse.json({
        uploadStatus: file.uploadStatus,
        uploadId: file.multipartUploadId,
        uploadedParts: partsRecord(file.uploadedParts),
      });
    }

    if (action === "sign-part") {
      const { fileId, uploadId, partNumber } = body;
      if (!fileId || !uploadId || typeof partNumber !== "number") {
        return NextResponse.json({ error: "fileId, uploadId, and partNumber required" }, { status: 400 });
      }
      if (partNumber < 1 || partNumber > 10000) {
        return NextResponse.json({ error: "partNumber must be between 1 and 10000" }, { status: 400 });
      }
      const file = await verifyFileAccess(fileId, session.user.id);
      if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
      const signed = await r2.getUploadPartUrl(file.r2StorageKey as string, uploadId, partNumber, 7200);
      return NextResponse.json({ url: signed });
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
      if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
      if (file.uploadStatus === "READY") {
        // Already finalized (a retry of a complete whose response was lost).
        return NextResponse.json({ file, alreadyComplete: true });
      }
      if (file.multipartUploadId !== uploadId) {
        return NextResponse.json({ error: "This upload is no longer open" }, { status: 409 });
      }

      // Validate part shape so a malformed client doesn't drive R2 into an
      // error mid-finalize. The server's own record wins over the client's
      // list where both exist — a part the browser lost track of (tab
      // refreshed after the part landed) is still counted.
      const recorded = partsRecord(file.uploadedParts);
      const merged = new Map<number, string>();
      for (const [k, v] of Object.entries(recorded)) merged.set(Number(k), v);
      for (const p of parts as { partNumber: unknown; etag: unknown }[]) {
        const pn = typeof p.partNumber === "number" ? p.partNumber : NaN;
        const et = typeof p.etag === "string" ? p.etag : "";
        if (!Number.isInteger(pn) || pn < 1 || !et) {
          return NextResponse.json({ error: "Invalid part entry" }, { status: 400 });
        }
        if (!merged.has(pn)) merged.set(pn, et);
      }
      const cleanParts = Array.from(merged.entries())
        .map(([partNumber, etag]) => ({ partNumber, etag }))
        .sort((a, b) => a.partNumber - b.partNumber);

      // Every part from 1..N must be present or R2 rejects the assembly.
      const expectedParts = cleanParts.length;
      for (let i = 0; i < expectedParts; i++) {
        if (cleanParts[i].partNumber !== i + 1) {
          return NextResponse.json(
            { error: `Part ${i + 1} is missing; upload it before completing`, missingPart: i + 1 },
            { status: 400 }
          );
        }
      }

      try {
        await r2.completeMultipartUpload(file.r2StorageKey as string, uploadId, cleanParts);
      } catch (err) {
        multipartLogger.error({ err: formatError(err), fileId }, "R2 CompleteMultipartUpload failed");
        return NextResponse.json(
          { error: "Storage could not assemble the file. Try again; your uploaded parts are kept." },
          { status: 502 }
        );
      }

      // Belt and braces: the object must actually be readable before any
      // backer can be pointed at it.
      const exists = await r2.fileExists(file.r2StorageKey as string);
      if (!exists) {
        await db.digitalFile.update({ where: { id: fileId }, data: { uploadStatus: "FAILED" } });
        return NextResponse.json({ error: "Upload finished but the file is not readable in storage" }, { status: 502 });
      }

      if (file.replacesFileId) {
        // Replacement: move the new object onto the original file (keeps its
        // id, distributions and reading progress), drop the carrier row.
        const result = await applyFileReplacement({
          fileId: file.replacesFileId,
          newStorageKey: file.r2StorageKey as string,
          fileName: file.fileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          notifyBackers: body.notifyBackers === true,
        });
        await db.digitalFile.deleteMany({ where: { id: fileId } });
        multipartLogger.info(
          { replacedFileId: file.replacesFileId, parts: cleanParts.length, size: file.fileSize },
          "Digital file replacement complete"
        );
        return NextResponse.json({ replaced: true, fileId: file.replacesFileId, ...result });
      }

      const updated = await db.digitalFile.update({
        where: { id: fileId },
        data: {
          uploadStatus: "READY",
          uploadedAt: new Date(),
          multipartUploadId: null,
          uploadedParts: null,
        },
      });
      multipartLogger.info({ fileId, parts: cleanParts.length, size: file.fileSize }, "Digital file upload complete");
      return NextResponse.json({ file: updated });
    }

    if (action === "abort") {
      const { fileId, uploadId } = body;
      if (!fileId) {
        return NextResponse.json({ error: "fileId required" }, { status: 400 });
      }
      const file = await verifyFileAccess(fileId, session.user.id);
      if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
      if (file.uploadStatus === "READY") {
        return NextResponse.json({ error: "File is already uploaded; delete it instead" }, { status: 409 });
      }
      const openId = uploadId || file.multipartUploadId;
      if (openId && file.r2StorageKey) {
        await r2.abortMultipartUpload(file.r2StorageKey, openId);
      }
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
