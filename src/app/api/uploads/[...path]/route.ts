import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Base uploads directory - use env var or fallback to project directory
const UPLOADS_BASE = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

// MIME types for supported files
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    // Reconstruct the file path
    const relativePath = pathSegments.join("/");
    const filePath = path.join(UPLOADS_BASE, relativePath);

    // Security: Ensure we're only serving from uploads directory
    const uploadsDir = path.resolve(UPLOADS_BASE);
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Check if file exists
    if (!existsSync(resolvedPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get file extension and MIME type
    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeType = MIME_TYPES[ext];

    if (!mimeType) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    // Read and return the file
    const fileBuffer = await readFile(resolvedPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving upload:", error);
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}
