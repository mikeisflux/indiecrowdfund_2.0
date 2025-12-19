import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

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

  const user = await db.user.findUnique({
    where: { id: session.user.id },
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

    // Generate unique filename
    const ext = path.extname(file.name);
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

    // Write file to disk
    const filePath = path.join(uploadDir, filename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Generate URL - use /api/uploads/ route to serve files
    const url = `/api/uploads/${folder}/${subDir}/${filename}`;

    // Get image dimensions if applicable
    const width = null;
    const height = null;
    // Note: For production, you'd use a library like sharp to get dimensions

    // Create database record
    const mediaFile = await db.mediaFile.create({
      data: {
        uploaderId: authResult.user.id,
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
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
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
