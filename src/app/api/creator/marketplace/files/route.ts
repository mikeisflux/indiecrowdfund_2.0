import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { getR2Storage, generateMarketplaceFileKey } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * GET /api/creator/marketplace/files
 *
 * List user's uploaded marketplace PDFs from R2 bucket
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    // List files in user's marketplace folder
    const prefix = `marketplace/${session.user.id}/pdfs/`;
    const files = await r2.listFiles(prefix);

    // Get metadata for each file
    const filesWithMetadata = await Promise.all(
      files.map(async (file) => {
        // Extract filename from key
        const keyParts = file.key.split("/");
        const fullFilename = keyParts[keyParts.length - 1];
        const fileIdAndName = fullFilename.split("_");
        const fileId = fileIdAndName[0];
        const originalName = fileIdAndName.slice(1).join("_");

        return {
          id: fileId,
          key: file.key,
          name: originalName,
          size: file.size,
          uploadedAt: file.lastModified?.toISOString() || null,
          sizeFormatted: formatFileSize(file.size),
        };
      })
    );

    // Sort by upload date (newest first)
    filesWithMetadata.sort((a, b) => {
      if (!a.uploadedAt || !b.uploadedAt) return 0;
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    });

    return NextResponse.json({
      files: filesWithMetadata,
      count: filesWithMetadata.length,
    });
  } catch (error) {
    console.error("Error listing marketplace files:", error);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/creator/marketplace/files
 *
 * Get presigned URL to upload a new PDF to marketplace
 */
export async function POST(request: NextRequest) {
  console.log("[Marketplace Files] POST request received");

  try {
    console.log("[Marketplace Files] Checking session...");
    const session = await auth();
    if (!session?.user?.id) {
      console.log("[Marketplace Files] Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[Marketplace Files] Session valid for user:", session.user.id);

    let body;
    try {
      body = await request.json();
      console.log("[Marketplace Files] Request body:", JSON.stringify(body));
    } catch (parseError) {
      console.error("[Marketplace Files] Failed to parse request body:", parseError);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { fileName, fileSize, mimeType } = body;

    if (!fileName || !fileSize) {
      return NextResponse.json(
        { error: "Missing required fields: fileName, fileSize" },
        { status: 400 }
      );
    }

    // Validate file type (PDF only for marketplace books)
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

    // Validate file size (default 100MB for PDFs)
    const maxBytes = (settings.maxFileSizeMB || 100) * 1024 * 1024;
    if (fileSize > maxBytes) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${settings.maxFileSizeMB || 100}MB` },
        { status: 400 }
      );
    }

    console.log("[Marketplace Files] Getting R2 storage...");
    let r2;
    try {
      r2 = await getR2Storage();
    } catch (r2Error) {
      console.error("[Marketplace Files] Error initializing R2 storage:", r2Error);
      return NextResponse.json(
        { error: "Storage initialization failed" },
        { status: 500 }
      );
    }

    if (!r2) {
      console.error("[Marketplace Files] R2 storage not configured - check platform settings");
      return NextResponse.json(
        { error: "Storage not configured. Please configure R2 storage in admin settings." },
        { status: 500 }
      );
    }
    console.log("[Marketplace Files] R2 storage initialized successfully");

    // Generate storage key
    const fileId = crypto.randomUUID();
    const storageKey = generateMarketplaceFileKey(session.user.id, fileName, fileId);
    console.log("[Marketplace Files] Generated storage key:", storageKey);

    // Get presigned upload URL
    let uploadUrl: string;
    try {
      console.log("[Marketplace Files] Generating presigned URL...");
      uploadUrl = await r2.getUploadUrl(storageKey, {
        contentType: "application/pdf",
        expiresIn: 3600,
        metadata: {
          uploaderId: session.user.id,
          originalName: fileName,
        },
      });
      console.log("[Marketplace Files] Presigned URL generated successfully");
    } catch (signError) {
      console.error("[Marketplace Files] Error generating presigned URL:", signError);
      // Check for common R2/S3 errors
      const errorMessage = signError instanceof Error ? signError.message : "Unknown error";
      if (errorMessage.includes("digest") || errorMessage.includes("credential")) {
        return NextResponse.json(
          { error: "Storage credentials error. Please check R2 configuration." },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `Failed to generate upload URL: ${errorMessage}` },
        { status: 500 }
      );
    }

    console.log("[Marketplace Files] Returning success response");
    return NextResponse.json({
      uploadUrl,
      fileId,
      storageKey,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("[Marketplace Files] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";
    console.error("[Marketplace Files] Error stack:", errorStack);
    return NextResponse.json(
      { error: `Failed to create upload URL: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/creator/marketplace/files?key=...
 *
 * Delete a marketplace file from R2
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "File key is required" },
        { status: 400 }
      );
    }

    // Verify the file belongs to this user
    if (!key.startsWith(`marketplace/${session.user.id}/`)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Check if file is in use by any marketplace book
    const booksUsingFile = await prisma.marketplaceBook.count({
      where: {
        creatorId: session.user.id,
        pdfFileUrl: { contains: key },
        deletedAt: null,
      },
    });

    if (booksUsingFile > 0) {
      return NextResponse.json(
        { error: "Cannot delete file that is in use by a book" },
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

    await r2.deleteFile(key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting marketplace file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

/**
 * Format file size to human readable
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
