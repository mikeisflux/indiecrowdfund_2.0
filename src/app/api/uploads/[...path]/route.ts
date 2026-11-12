import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const uploadsLogger = logger.child({ module: "uploads" });
import { readFile, stat } from "fs/promises";
import { existsSync, createReadStream } from "fs";
import { Readable } from "stream";
import path from "path";
import sharp from "sharp";

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
  // Favicons uploaded via Settings > General > Logo & Branding. Without
  // this entry the serving route answered 400 for its own upload.
  ".ico": "image/x-icon",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    // Reconstruct the file path
    const relativePath = pathSegments.join("/");
    const filePath = path.join(/*turbopackIgnore: true*/ UPLOADS_BASE, relativePath);

    // Security: Ensure we're only serving from uploads directory
    const uploadsDir = path.resolve(/*turbopackIgnore: true*/ UPLOADS_BASE);
    const resolvedPath = path.resolve(/*turbopackIgnore: true*/ filePath);

    if (!resolvedPath.startsWith(uploadsDir + path.sep) && resolvedPath !== uploadsDir) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Check if file exists, with fallback to .webp for legacy .png/.jpg references
    let finalPath = resolvedPath;
    let ext = path.extname(resolvedPath).toLowerCase();

    if (!existsSync(/*turbopackIgnore: true*/ resolvedPath)) {
      // If requesting .png or .jpg but file doesn't exist, try .webp version
      // (handles legacy URLs from before WebP conversion was added)
      if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
        const webpPath = resolvedPath.replace(/\.(png|jpe?g)$/i, ".webp");
        if (existsSync(webpPath)) {
          finalPath = webpPath;
          ext = ".webp";
          // Silent fallback - no logging needed for expected behavior
        } else {
          uploadsLogger.warn(`[Uploads] File not found: ${relativePath} (no .webp fallback)`);
          return NextResponse.json({ error: "File not found" }, { status: 404 });
        }
      } else {
        uploadsLogger.warn(`[Uploads] File not found: ${relativePath}`);
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
    }

    // Get MIME type
    const mimeType = MIME_TYPES[ext];

    if (!mimeType) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    // Get file stats for size
    const fileStat = await stat(/*turbopackIgnore: true*/ finalPath);
    const fileSize = fileStat.size;

    // Range requests for every file type, streamed from disk. Video
    // players need them for seeking; pdf.js uses them to fetch pages on
    // demand instead of downloading the whole book first. A 22 MB preview
    // PDF served as one buffered response failed with an empty 500 for a
    // visitor arriving from Facebook; served in ranges, the viewer shows
    // the first page after a few hundred KB.
    const rangeHeader = req.headers.get("range");
    const rangeMatch = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);

    if (rangeMatch && (rangeMatch[1] || rangeMatch[2])) {
      let start: number;
      let end: number;
      if (rangeMatch[1]) {
        start = parseInt(rangeMatch[1], 10);
        end = rangeMatch[2] ? Math.min(parseInt(rangeMatch[2], 10), fileSize - 1) : fileSize - 1;
      } else {
        // Suffix range: the last N bytes (pdf.js reads the xref trailer this way).
        const suffix = Math.min(parseInt(rangeMatch[2], 10), fileSize);
        start = fileSize - suffix;
        end = fileSize - 1;
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}`, "Accept-Ranges": "bytes" },
        });
      }
      const chunkSize = end - start + 1;
      const nodeStream = createReadStream(/*turbopackIgnore: true*/ finalPath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
      return new NextResponse(webStream, {
        status: 206, // Partial Content
        headers: {
          "Content-Type": mimeType,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Cache-Control": "public, max-age=31536000",
        },
      });
    }

    // Large files (PDF previews, videos without a Range header) are
    // streamed rather than read into memory; a dozen concurrent 20 MB
    // reads could exhaust the heap.
    const STREAM_THRESHOLD = 8 * 1024 * 1024;
    if (fileSize > STREAM_THRESHOLD && !(ext === ".webp" && req.nextUrl.searchParams.get("format") === "jpeg")) {
      const nodeStream = createReadStream(/*turbopackIgnore: true*/ finalPath);
      const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
      return new NextResponse(webStream, {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(fileSize),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000",
        },
      });
    }

    // Read the file
    const fileBuffer = await readFile(/*turbopackIgnore: true*/ finalPath);

    // Support format conversion via ?format=jpeg (useful for og:image compatibility)
    // ALSO auto-convert WebP → JPEG when a social-media crawler fetches the file.
    // Facebook, X, LinkedIn, etc. reject WebP images entirely, which breaks share
    // previews even though the HTML and OG tags are perfectly valid.
    const requestedFormat = req.nextUrl.searchParams.get("format");
    const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
    const isSocialCrawlerUA =
      userAgent.includes("facebookexternalhit") ||
      userAgent.includes("facebookcatalog") ||
      userAgent.includes("facebot") ||
      userAgent.includes("meta-externalagent") ||
      userAgent.includes("meta-externalfetcher") ||
      userAgent.includes("twitterbot") ||
      userAgent.includes("linkedinbot") ||
      userAgent.includes("pinterest") ||
      userAgent.includes("slackbot") ||
      userAgent.includes("discordbot") ||
      userAgent.includes("telegrambot") ||
      userAgent.includes("whatsapp");
    const shouldConvertToJpeg =
      ext === ".webp" && (requestedFormat === "jpeg" || isSocialCrawlerUA);

    if (shouldConvertToJpeg) {
      try {
        const jpegBuffer = await sharp(fileBuffer).jpeg({ quality: 85 }).toBuffer();
        return new NextResponse(new Uint8Array(jpegBuffer), {
          headers: {
            "Content-Type": "image/jpeg",
            "Content-Length": String(jpegBuffer.length),
            "Cache-Control": "public, max-age=31536000",
            // Vary on User-Agent so CDN caches don't serve the JPEG to browsers
            // or the WebP to crawlers.
            "Vary": "User-Agent",
          },
        });
      } catch (conversionError) {
        uploadsLogger.error({ err: String(conversionError) }, "WebP to JPEG conversion failed, serving original");
      }
    }

    // Return the full file (for images or non-range video requests)
    // Long max-age for speed, but NO `immutable` directive — the og:image
    // layout appends a ?v=<mtime> cache-buster to differentiate versions,
    // and `immutable` tells Facebook's image CDN to never refetch even
    // when Scrape Again is clicked, which permanently stuck us on broken
    // versions of covers during debugging.
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    // A file that vanished between the existence check and the read, or
    // a path that is a directory, is a 404, not a server fault.
    const code = (error as NodeJS.ErrnoException)?.code;
    const relative = decodeURIComponent(req.nextUrl.pathname.replace(/^\/api\/uploads\//, ""));
    if (code === "ENOENT" || code === "EISDIR" || code === "ENOTDIR") {
      uploadsLogger.warn({ code, path: relative }, "[Uploads] File not readable");
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    if (code === "EACCES" || code === "EPERM") {
      uploadsLogger.error({ code, path: relative }, "[Uploads] Permission denied reading upload");
      return NextResponse.json({ error: "File not accessible" }, { status: 403 });
    }
    uploadsLogger.error({ err: formatError(error), code, path: relative }, "Error serving upload:");
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}
