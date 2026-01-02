import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { getR2Storage, generateMarketplaceFileKey } from "@/lib/r2";

export const dynamic = "force-dynamic";

// Increase body size limit for file uploads (100MB)
export const maxDuration = 60; // 60 seconds timeout

/**
 * POST /api/creator/marketplace/files/upload
 *
 * Server-side proxy upload for marketplace PDFs
 * This bypasses CORS issues by having the server upload to R2
 */
export async function POST(request: NextRequest) {
  console.log("[Marketplace Upload] POST request received");

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

    console.log("[Marketplace Upload] File info:", { fileName, fileSize, mimeType });

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
    console.log("[Marketplace Upload] Storage key:", storageKey);

    // Convert file to buffer and upload to R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("[Marketplace Upload] Uploading to R2...");
    await r2.uploadFile(storageKey, buffer, {
      contentType: "application/pdf",
      metadata: {
        uploaderId: session.user.id,
        originalName: fileName,
      },
    });
    console.log("[Marketplace Upload] Upload successful");

    // Generate the public URL for the file
    const publicUrl = `/api/r2/serve/${encodeURIComponent(storageKey)}`;

    return NextResponse.json({
      success: true,
      fileId,
      storageKey,
      publicUrl,
      fileName,
      fileSize,
    });
  } catch (error) {
    console.error("[Marketplace Upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
