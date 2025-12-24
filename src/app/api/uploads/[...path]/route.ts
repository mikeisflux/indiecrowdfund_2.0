import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
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
  ".mov": "video/quicktime",
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

    // Debug logging
    console.log(`[Uploads] Request: ${relativePath}`);
    console.log(`[Uploads] UPLOADS_BASE: ${UPLOADS_BASE}`);
    console.log(`[Uploads] Resolved path: ${resolvedPath}`);
    console.log(`[Uploads] File exists: ${existsSync(resolvedPath)}`);

    if (!resolvedPath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Check if file exists, with fallback to .webp for legacy .png/.jpg references
    let finalPath = resolvedPath;
    let ext = path.extname(resolvedPath).toLowerCase();

    if (!existsSync(resolvedPath)) {
      // If requesting .png or .jpg but file doesn't exist, try .webp version
      // (handles legacy URLs from before WebP conversion was added)
      if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
        const webpPath = resolvedPath.replace(/\.(png|jpe?g)$/i, ".webp");
        if (existsSync(webpPath)) {
          finalPath = webpPath;
          ext = ".webp";
        } else {
          return NextResponse.json({ error: "File not found" }, { status: 404 });
        }
      } else {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
    }

    // Get MIME type
    const mimeType = MIME_TYPES[ext];

    if (!mimeType) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    // Get file stats for size
    const fileStat = await stat(finalPath);
    const fileSize = fileStat.size;

    // Check if this is a video and if Range header is present
    const isVideo = mimeType.startsWith("video/");
    const rangeHeader = req.headers.get("range");

    if (isVideo && rangeHeader) {
      // Parse Range header (e.g., "bytes=0-1024")
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      // Read the specific chunk
      const fileBuffer = await readFile(finalPath);
      const chunk = fileBuffer.subarray(start, end + 1);

      return new NextResponse(chunk, {
        status: 206, // Partial Content
        headers: {
          "Content-Type": mimeType,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Read and return the full file (for images or non-range video requests)
    const fileBuffer = await readFile(finalPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(fileSize),
        "Accept-Ranges": isVideo ? "bytes" : "none",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving upload:", error);
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}
