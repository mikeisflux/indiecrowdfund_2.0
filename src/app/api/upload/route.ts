import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const uploadLogger = logger.child({ module: "upload" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

// Base uploads directory - use env var or fallback to project directory
const UPLOADS_BASE = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

// Allowed image types
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Allowed video types
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

// All allowed types
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// Size limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB for videos

const WEBP_QUALITY = 85;

// Types that should be converted to WebP
const CONVERT_TO_WEBP = ["image/jpeg", "image/png"];

// Generate a unique filename with WebP extension for converted images
function generateFilename(originalName: string, convertToWebP: boolean): string {
  const hash = crypto.randomBytes(16).toString("hex");
  if (convertToWebP) {
    return `${hash}.webp`;
  }
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  return `${hash}${ext}`;
}

// Check if user can upload to a project (creator or collaborator with edit permission)
async function canUploadToProject(projectId: string, userId: string): Promise<boolean> {
  const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null },
    select: { creatorId: true },
  });

  if (!project) {
    return false;
  }

  // Creator can always upload
  if (project.creatorId === userId) {
    return true;
  }

  // Check if user is a collaborator with edit permission
  const collaborator = await db.projectCollaborator.findFirst({
    where: {
      projectId,
      userId,
      status: "ACCEPTED",
      canEditProject: true,
    },
  });

  return !!collaborator;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    // Accept both "type" and "uploadType" for compatibility
    const type = (formData.get("type") || formData.get("uploadType")) as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // If projectId is provided, verify user has permission to upload to this project
    if (projectId && projectId !== "temp") {
      const canUpload = await canUploadToProject(projectId, session.user.id);
      if (!canUpload) {
        return NextResponse.json(
          { error: "You don't have permission to upload to this project" },
          { status: 403 }
        );
      }
    }

    // Use "temp" folder if no projectId yet (new unsaved projects)
    const effectiveProjectId = projectId || "temp";

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPG, PNG, GIF, WEBP" },
        { status: 400 }
      );
    }

    // Validate file size based on type
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    const maxSizeLabel = isVideo ? "200MB" : "10MB";

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxSizeLabel}` },
        { status: 400 }
      );
    }

    // Sanitize uploadType to prevent path traversal - only allow alphanumeric, hyphens, underscores
    const rawType = type || "misc";
    const uploadType = rawType.replace(/[^a-zA-Z0-9_-]/g, "") || "misc";

    // Sanitize effectiveProjectId - only allow alphanumeric and hyphens (CUID chars + "temp")
    const safeProjectId = effectiveProjectId.replace(/[^a-zA-Z0-9-]/g, "") || "temp";

    const uploadDir = path.join(
      UPLOADS_BASE,
      "projects",
      safeProjectId,
      uploadType
    );

    // Guard against path traversal: ensure uploadDir stays within UPLOADS_BASE
    const resolvedBase = path.resolve(UPLOADS_BASE);
    const resolvedDir = path.resolve(uploadDir);
    if (!resolvedDir.startsWith(resolvedBase + path.sep) && resolvedDir !== resolvedBase) {
      return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
    }

    // Ensure directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Check if we should convert to WebP
    const shouldConvert = CONVERT_TO_WEBP.includes(file.type);

    // Generate unique filename
    const filename = generateFilename(file.name, shouldConvert);
    const filePath = path.join(uploadDir, filename);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Convert to WebP if needed, otherwise write directly
    let finalBuffer: Buffer;
    let finalMimeType: string;
    let finalSize: number;

    if (shouldConvert) {
      // Convert PNG/JPG to WebP using sharp
      finalBuffer = await sharp(buffer)
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      finalMimeType = "image/webp";
      finalSize = finalBuffer.length;
    } else {
      finalBuffer = buffer;
      finalMimeType = file.type;
      finalSize = file.size;
    }

    await writeFile(filePath, finalBuffer);

    // For project cover images specifically, also write a .jpg companion.
    // Social media crawlers (Facebook, X, LinkedIn, Pinterest) reject WebP,
    // so we pre-generate a real JPEG on disk at the same path with a .jpg
    // extension. The og:image URL in the project layout points at .jpg
    // directly — no runtime conversion, no CDN cache surprises.
    //
    // Encoding settings optimized for Facebook's picky decoder:
    //   - Resize to exactly 1200x630 (FB's recommended dimensions; below
    //     this threshold FB 2025/2026 rejects the image outright). Use
    //     contain-fit with white letterbox padding so the creator's cover
    //     art is never cropped.
    //   - Baseline JPEG (not progressive)
    //   - sRGB color space, no ICC profile, no EXIF/XMP (default sharp
    //     strip behavior — do NOT call .withMetadata which preserves it)
    //   - Standard libjpeg (not mozjpeg)
    //   - White flatten for transparent source WebPs
    if (uploadType === "project" && finalMimeType === "image/webp") {
      try {
        const jpgBuffer = await sharp(finalBuffer)
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .resize(1200, 630, {
            fit: "contain",
            background: { r: 255, g: 255, b: 255 },
            withoutEnlargement: false,
          })
          .toColorspace("srgb")
          .jpeg({
            quality: 85,
            progressive: false,
            mozjpeg: false,
            chromaSubsampling: "4:2:0",
          })
          .toBuffer();
        const jpgPath = filePath.replace(/\.webp$/i, ".jpg");
        await writeFile(jpgPath, jpgBuffer);
      } catch (jpgErr) {
        // Non-fatal — the webp upload still succeeded. The uploads route's
        // runtime WebP→JPEG fallback will kick in if this companion is missing.
        uploadLogger.warn(
          { err: String(jpgErr) },
          "[Upload] Failed to write JPG companion for project cover"
        );
      }
    }

    // Return the API URL for serving the image
    const url = `/api/uploads/projects/${effectiveProjectId}/${uploadType}/${filename}`;

    // Determine the folder name for the media library
    // Use project-specific folder or the upload type
    const folderName = projectId ? `projects` : uploadType;

    // Create MediaFile record to track in the admin media library
    try {
      await db.mediaFile.create({
        data: {
          uploaderId: session.user.id,
          filename,
          originalName: file.name,
          mimeType: finalMimeType,
          size: finalSize,
          url,
          thumbnailUrl: url, // Use same URL for images
          width: null,
          height: null,
          duration: null,
          folder: folderName,
          tags: projectId ? [`project:${projectId}`] : [],
          altText: null,
        },
      });
    } catch (dbError) {
      // Log but don't fail - the file was still uploaded successfully
      uploadLogger.error({ err: String(dbError) }, "Error creating MediaFile record:");
    }

    return NextResponse.json({
      success: true,
      url,
      filename,
    });
  } catch (error) {
    uploadLogger.error({ err: String(error) }, "Upload error:");
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
