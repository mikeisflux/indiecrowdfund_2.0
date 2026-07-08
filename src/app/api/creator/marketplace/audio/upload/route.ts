import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const audioUploadLogger = logger.child({ module: "creator-marketplace-audio-upload" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { getR2Storage } from "@/lib/r2";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 minutes for large audio files

const ALLOWED_AUDIO_EXTENSIONS = /\.(mp3|wav|flac|aac|ogg|m4a|wma|alac|aiff)$/i;
const ALLOWED_AUDIO_MIMES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/ogg",
  "audio/vorbis",
  "audio/x-ms-wma",
  "audio/aiff",
  "audio/x-aiff",
];

function generateAudioFileKey(userId: string, originalFilename: string, fileId?: string): string {
  const id = fileId || crypto.randomUUID();
  const sanitizedName = originalFilename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .substring(0, 80);
  return `marketplace/${userId}/audio/${id}_${sanitizedName}`;
}

async function calculateFileHash(buffer: Buffer): Promise<string> {
  const hash = createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

/**
 * POST /api/creator/marketplace/audio/upload
 *
 * Server-side proxy upload for marketplace audio files to R2.
 * Supports MP3, WAV, FLAC, AAC, OGG, M4A, etc.
 * Includes duplicate detection via SHA-256 hash.
 */
export async function POST(request: NextRequest) {
  audioUploadLogger.info("[Audio Upload] POST request received");

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

    audioUploadLogger.info({ data: { fileName, fileSize, mimeType } }, "[Audio Upload] File info");

    // Validate file type
    const isAudioMime = ALLOWED_AUDIO_MIMES.includes(mimeType);
    const isAudioExt = ALLOWED_AUDIO_EXTENSIONS.test(fileName);
    if (!isAudioMime && !isAudioExt) {
      return NextResponse.json(
        { error: "Only audio files are allowed (MP3, WAV, FLAC, AAC, OGG, M4A)" },
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

    // Validate file size (default 100MB, audio can be large)
    const maxBytes = (settings.maxFileSizeMB || 100) * 1024 * 1024;
    if (fileSize > maxBytes) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${settings.maxFileSizeMB || 100}MB` },
        { status: 400 }
      );
    }

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    // Generate storage key
    const fileId = crypto.randomUUID();
    const storageKey = generateAudioFileKey(session.user.id, fileName, fileId);
    audioUploadLogger.info({ data: storageKey }, "[Audio Upload] Storage key");

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Calculate hash for duplicate detection
    const fileHash = await calculateFileHash(buffer);
    audioUploadLogger.info({ data: fileHash }, "[Audio Upload] File hash");

    // Check for duplicates
    const prefix = `marketplace/${session.user.id}/audio/`;
    const existingFiles = await r2.listFiles(prefix);
    const sameSizeFiles = existingFiles.filter((f) => f.size === fileSize);

    for (const existing of sameSizeFiles) {
      try {
        const metadata = await r2.getFileMetadata(existing.key);
        const storedHash = metadata?.metadata?.filehash || metadata?.metadata?.fileHash;
        if (storedHash === fileHash) {
          audioUploadLogger.info({ data: existing.key }, "[Audio Upload] Duplicate detected");

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
        mp3: "audio/mpeg",
        wav: "audio/wav",
        flac: "audio/flac",
        aac: "audio/aac",
        ogg: "audio/ogg",
        m4a: "audio/mp4",
        wma: "audio/x-ms-wma",
        aiff: "audio/aiff",
        alac: "audio/mp4",
      };
      contentType = (ext && mimeMap[ext]) || "audio/mpeg";
    }

    // Upload to R2
    audioUploadLogger.info("[Audio Upload] Uploading to R2...");
    await r2.uploadFile(storageKey, buffer, {
      contentType,
      metadata: {
        uploaderid: session.user.id,
        originalname: fileName,
        filehash: fileHash,
      },
    });
    audioUploadLogger.info("[Audio Upload] Upload successful");

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
    audioUploadLogger.error({ err: formatError(error) }, "[Audio Upload] Error");
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
