import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorMediaUploadLogger = logger.child({ module: "creator-media-upload" });
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

export const runtime = "nodejs";

// Allowed image MIME types for creator uploads
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Max file size (10MB for creator uploads)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "email-campaigns";
    const altText = formData.get("altText") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type (images only for creators)
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} not allowed. Only images are permitted.` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Check if we should convert to WebP
    const shouldConvert = CONVERT_TO_WEBP.includes(file.type);

    // Generate unique filename
    const ext = shouldConvert ? ".webp" : path.extname(file.name);
    const filename = `${uuidv4()}${ext}`;

    // Always store in images subdirectory
    const subDir = "images";

    // Create upload directory if it doesn't exist
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

      // Get dimensions for non-converted images
      try {
        const metadata = await sharp(buffer).metadata();
        width = metadata.width || null;
        height = metadata.height || null;
      } catch {
        // Ignore dimension errors
      }
    }

    // Write file to disk
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, finalBuffer);

    // Generate URL
    const url = `/api/uploads/${folder}/${subDir}/${filename}`;

    // Create database record
    const mediaFile = await db.mediaFile.create({
      data: {
        uploaderId: session.user.id,
        filename,
        originalName: file.name,
        mimeType: finalMimeType,
        size: finalSize,
        url,
        thumbnailUrl: url,
        width,
        height,
        duration: null,
        folder,
        tags: [],
        altText,
      },
    });

    return NextResponse.json({
      success: true,
      file: mediaFile,
    });
  } catch (error) {
    creatorMediaUploadLogger.error({ err: String(error) }, "Error uploading file:");
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
