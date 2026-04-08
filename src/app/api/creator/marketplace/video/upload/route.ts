import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const videoUploadLogger = logger.child({ module: "creator-marketplace-video-upload" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { getR2Storage } from "@/lib/r2";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for large video files

const ALLOWED_VIDEO_EXTENSIONS = /\.(mp4|mkv|mov|avi|webm|m4v|wmv|flv|ts|mts)$/i;
const ALLOWED_VIDEO_MIMES = [
  "video/mp4",
  "video/x-matroska",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/x-m4v",
  "video/x-ms-wmv",
  "video/x-flv",
  "video/mp2t",
  "application/octet-stream", // some browsers send this for video
];

function generateVideoFileKey(userId: string, originalFilename: string, fileId?: string): string {
  const id = fileId || crypto.randomUUID();
  const sanitizedName = originalFilename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .substring(0, 80);
  return `marketplace/${userId}/video/${id}_${sanitizedName}`;
}

async function calculateFileHash(buffer: Buffer): Promise<string> {
  const hash = createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

/**
 * POST /api/creator/marketplace/video/upload
 *
 * Server-side proxy upload for marketplace video files to R2.
 * Supports MP4, MKV, MOV, AVI, WebM, etc.
 * Includes duplicate detection via SHA-256 hash.
 */
export async function POST(request: NextRequest) {
  videoUploadLogger.info("[Video Upload] POST request received");

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type;

    videoUploadLogger.info({ data: { fileName, fileSize, mimeType } }, "[Video Upload] File info");

    // Validate file type
    const isVideoMime = ALLOWED_VIDEO_MIMES.includes(mimeType);
    const isVideoExt = ALLOWED_VIDEO_EXTENSIONS.test(fileName);
    if (!isVideoMime && !isVideoExt) {
      return NextResponse.json(
        { error: "Only video files are allowed (MP4, MKV, MOV, AVI, WebM)" },
        { status: 400 }
      );
    }

    // Check R2 is enabled
    const settings = await prisma.platformSettings.findFirst({
      select: { r2Enabled: true, maxFileSizeMB: true },
    });

    if (!settings?.r2Enabled) {
      return NextResponse.json({ error: "Cloud storage is not enabled" }, { status: 400 });
    }

    // Videos can be very large — use a higher limit (2GB or configured max)
    const maxMB = Math.max(settings.maxFileSizeMB || 100, 2048);
    const maxBytes = maxMB * 1024 * 1024;
    if (fileSize > maxBytes) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${maxMB}MB` },
        { status: 400 }
      );
    }

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    // Generate storage key
    const fileId = crypto.randomUUID();
    const storageKey = generateVideoFileKey(session.user.id, fileName, fileId);
    videoUploadLogger.info({ data: storageKey }, "[Video Upload] Storage key");

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Calculate hash for duplicate detection
    const fileHash = await calculateFileHash(buffer);
    videoUploadLogger.info({ data: fileHash }, "[Video Upload] File hash");

    // Check for duplicates
    const prefix = `marketplace/${session.user.id}/video/`;
    const existingFiles = await r2.listFiles(prefix);
    const sameSizeFiles = existingFiles.filter((f) => f.size === fileSize);

    for (const existing of sameSizeFiles) {
      try {
        const metadata = await r2.getFileMetadata(existing.key);
        const storedHash = metadata?.metadata?.filehash || metadata?.metadata?.fileHash;
        if (storedHash === fileHash) {
          videoUploadLogger.info({ data: existing.key }, "[Video Upload] Duplicate detected");

          const keyParts = existing.key.split("/");
          const fullFilename = keyParts[keyParts.length - 1];
          const parts = fullFilename.split("_");
          const existingFileId = parts[0];
          const existingFileName = parts.slice(1).join("_");

          return NextResponse.json({
            success: true,
            fileId: existingFileId,
            storageKey: existing.key,
            url: `/api/r2/serve/${existing.key}`,
            fileName: existingFileName,
            fileSize: existing.size,
            isDuplicate: true,
            message: "This file was already uploaded. Using existing copy.",
          });
        }
      } catch {
        // Skip files we can't check
      }
    }

    // Determine content type
    let contentType = mimeType;
    if (!contentType || contentType === "application/octet-stream") {
      const ext = fileName.split(".").pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        mp4: "video/mp4",
        mkv: "video/x-matroska",
        mov: "video/quicktime",
        avi: "video/x-msvideo",
        webm: "video/webm",
        m4v: "video/x-m4v",
        wmv: "video/x-ms-wmv",
        flv: "video/x-flv",
        ts: "video/mp2t",
        mts: "video/mp2t",
      };
      contentType = (ext && mimeMap[ext]) || "video/mp4";
    }

    // Upload to R2
    videoUploadLogger.info("[Video Upload] Uploading to R2...");
    await r2.uploadFile(storageKey, buffer, {
      contentType,
      metadata: {
        uploaderid: session.user.id,
        originalname: fileName,
        filehash: fileHash,
      },
    });
    videoUploadLogger.info("[Video Upload] Upload successful");

    const url = `/api/r2/serve/${storageKey}`;

    return NextResponse.json({
      success: true,
      fileId,
      storageKey,
      url,
      fileName,
      fileSize,
    });
  } catch (error) {
    videoUploadLogger.error({ err: String(error) }, "[Video Upload] Error");
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
