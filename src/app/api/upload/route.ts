import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

// Allowed image types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// Generate a unique filename
function generateFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const hash = crypto.randomBytes(16).toString("hex");
  return `${hash}${ext}`;
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

    // Generate unique filename
    const filename = generateFilename(file.name);
    const filePath = path.join(uploadDir, filename);

    // Convert file to buffer and write
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

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
          mimeType: file.type,
          size: file.size,
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
