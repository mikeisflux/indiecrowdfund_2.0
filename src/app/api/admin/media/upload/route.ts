import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminMediaUploadLogger = logger.child({ module: "admin-media-upload" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

// WebP conversion settings
const WEBP_QUALITY = 85;
const CONVERT_TO_WEBP = ["image/jpeg", "image/png"];

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Disable body parser for file uploads
export const runtime = "nodejs";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true }
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// Allowed MIME types
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Max file size (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "uploads";
    const altText = formData.get("altText") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} not allowed` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 50MB limit" },
        { status: 400 }
      );
    }

    // Check if we should convert to WebP
    const shouldConvert = CONVERT_TO_WEBP.includes(file.type);

    // Generate unique filename
    const ext = shouldConvert ? ".webp" : path.extname(file.name);
    const filename = `${uuidv4()}${ext}`;

    // Determine upload directory based on file type
    let subDir = "misc";
    if (file.type.startsWith("image")) subDir = "images";
    else if (file.type.startsWith("video")) subDir = "videos";
    else if (file.type.includes("pdf") || file.type.includes("document")) subDir = "documents";

    // Create upload directory if it doesn't exist
    // Use 'uploads/' (not 'public/uploads/') so files are served via /api/uploads/ route
    // This works in production where public/ is read-only after build
    const uploadDir = path.join(process.cwd(), "uploads", folder, subDir);
    await mkdir(uploadDir, { recursive: true });

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Convert to WebP if needed, otherwise write directly
    let finalBuffer: Buffer;
    let finalMimeType: string;
    let finalSize: number;
    let width: number | null = null;
    let height: number | null = null;

    if (shouldConvert) {
      // Convert PNG/JPG to WebP using sharp and get dimensions
      const sharpInstance = sharp(buffer);
      const metadata = await sharpInstance.metadata();
      width = metadata.width || null;
      height = metadata.height || null;

      finalBuffer = await sharpInstance
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      finalMimeType = "image/webp";
      finalSize = finalBuffer.length;
    } else {
      finalBuffer = buffer;
      finalMimeType = file.type;
      finalSize = file.size;

      // Get dimensions for non-converted images if applicable
      if (file.type.startsWith("image") && !file.type.includes("svg")) {
        try {
          const metadata = await sharp(buffer).metadata();
          width = metadata.width || null;
          height = metadata.height || null;
        } catch {
          // Ignore dimension errors
        }
      }
    }

    // Write file to disk
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, finalBuffer);

    // Generate URL - use /api/uploads/ route to serve files
    const url = `/api/uploads/${folder}/${subDir}/${filename}`;

    // Create database record
    const mediaFile = await db.mediaFile.create({
      data: {
        uploaderId: authResult.user.id,
        filename,
        originalName: file.name,
        mimeType: finalMimeType,
        size: finalSize,
        url,
        thumbnailUrl: file.type.startsWith("image") ? url : null,
        width,
        height,
        duration: null,
        folder,
        tags: [],
        altText
      }
    });

    return NextResponse.json({
      success: true,
      file: mediaFile
    });
  } catch (error) {
    adminMediaUploadLogger.error({ err: String(error) }, "Error uploading file:");
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
