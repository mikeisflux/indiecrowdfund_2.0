import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

// Allowed image types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
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
  const project = await db.project.findUnique({
    where: { id: projectId },
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

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Create directory structure: /uploads/projects/{projectId}/{type}/
    const uploadType = type || "misc";
    const uploadDir = path.join(
      process.cwd(),
      "uploads",
      "projects",
      effectiveProjectId,
      uploadType
    );

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
      console.error("Error creating MediaFile record:", dbError);
    }

    return NextResponse.json({
      success: true,
      url,
      filename,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
