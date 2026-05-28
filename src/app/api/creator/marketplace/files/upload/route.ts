import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorMarketplaceFilesUploadLogger = logger.child({ module: "creator-marketplace-files-upload" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { getR2Storage, generateMarketplaceFileKey } from "@/lib/r2";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

// Increase body size limit for file uploads (100MB)
export const maxDuration = 60; // 60 seconds timeout

/**
 * Calculate SHA-256 hash of file content for duplicate detection
 */
async function calculateFileHash(buffer: Buffer): Promise<string> {
  const hash = createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

/**
 * POST /api/creator/marketplace/files/upload
 *
 * Server-side proxy upload for marketplace PDFs
 * This bypasses CORS issues by having the server upload to R2
 * Includes duplicate detection - returns existing file if same content already uploaded
 */
export async function POST(request: NextRequest) {
  creatorMarketplaceFilesUploadLogger.info("[Marketplace Upload] POST request received");

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get form data with the file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type;

    creatorMarketplaceFilesUploadLogger.info({ data: { fileName, fileSize, mimeType } }, "[Marketplace Upload] File info:");

    // Validate file type (PDF only)
    if (mimeType !== "application/pdf" && !fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are allowed for marketplace books" },
        { status: 400 }
      );
    }

    // Get storage settings
    const settings = await prisma.platformSettings.findFirst({
      select: {
        r2Enabled: true,
        maxFileSizeMB: true,
      },
    });

    if (!settings?.r2Enabled) {
      return NextResponse.json(
        { error: "Cloud storage is not enabled" },
        { status: 400 }
      );
    }

    // Validate file size (default 100MB)
    const maxBytes = (settings.maxFileSizeMB || 100) * 1024 * 1024;
    if (fileSize > maxBytes) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${settings.maxFileSizeMB || 100}MB` },
        { status: 400 }
      );
    }

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    // Generate storage key
    const fileId = crypto.randomUUID();
    const storageKey = generateMarketplaceFileKey(session.user.id, fileName, fileId);
    creatorMarketplaceFilesUploadLogger.info({ data: storageKey }, "[Marketplace Upload] Storage key:");

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Calculate file hash for duplicate detection
    const fileHash = await calculateFileHash(buffer);
    creatorMarketplaceFilesUploadLogger.info({ data: fileHash }, "[Marketplace Upload] File hash:");

    // Check if this exact file already exists in user's uploads
    // First filter by size (fast), then check hash in metadata
    const prefix = `marketplace/${session.user.id}/pdfs/`;
    const existingFiles = await r2.listFiles(prefix);

    // Look for files with same size (potential duplicates)
    const sameSizeFiles = existingFiles.filter(f => f.size === fileSize);

    for (const existingFile of sameSizeFiles) {
      try {
        // Check metadata for stored hash
        const metadata = await r2.getFileMetadata(existingFile.key);
        const storedHash = metadata?.metadata?.filehash || metadata?.metadata?.fileHash;

        if (storedHash === fileHash) {
          creatorMarketplaceFilesUploadLogger.info({ data: existingFile.key }, "[Marketplace Upload] Duplicate file detected via hash:");

          // Extract original filename from key
          const keyParts = existingFile.key.split("/");
          const fullFilename = keyParts[keyParts.length - 1];
          const fileIdAndName = fullFilename.split("_");
          const existingFileId = fileIdAndName[0];
          const existingFileName = fileIdAndName.slice(1).join("_");

          // Return the existing file info instead of uploading duplicate
          return NextResponse.json({
            success: true,
            fileId: existingFileId,
            storageKey: existingFile.key,
            publicUrl: `/api/r2/serve/${existingFile.key}`,
            fileName: existingFileName,
            fileSize: existingFile.size,
            isDuplicate: true,
            message: "This file was already uploaded. Using existing copy.",
          });
        }
      } catch (checkError) {
        // Skip files we can't check, continue with upload
        creatorMarketplaceFilesUploadLogger.info({ data: existingFile.key, checkError }, "[Marketplace Upload] Could not check existing file metadata:");
      }
    }

    creatorMarketplaceFilesUploadLogger.info("[Marketplace Upload] Uploading to R2...");
    await r2.uploadFile(storageKey, buffer, {
      contentType: "application/pdf",
      metadata: {
        uploaderid: session.user.id,
        originalname: fileName,
        filehash: fileHash, // lowercase for R2/S3 metadata compatibility
      },
    });
    creatorMarketplaceFilesUploadLogger.info("[Marketplace Upload] Upload successful");

    // Generate the public URL for the file
    // Don't encode the entire storageKey since it contains slashes that are part of the path
    const publicUrl = `/api/r2/serve/${storageKey}`;

    return NextResponse.json({
      success: true,
      fileId,
      storageKey,
      publicUrl,
      fileName,
      fileSize,
    });
  } catch (error) {
    creatorMarketplaceFilesUploadLogger.error({ err: formatError(error) }, "[Marketplace Upload] Error:");
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
