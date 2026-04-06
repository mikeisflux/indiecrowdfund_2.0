import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorDigitalFilesLogger = logger.child({ module: "creator-digital-files" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getR2Storage, generateFileKey } from "@/lib/r2";

// CORS headers for API responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET: List digital files for a project
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400, headers: corsHeaders });
    }

    // Verify user owns or collaborates on this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
      select: { id: true, title: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404, headers: corsHeaders });
    }

    const files = await db.digitalFile.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: {
          select: { id: true, name: true, image: true },
        },
        _count: {
          select: { distributions: true },
        },
      },
    });

    return NextResponse.json({ files }, { headers: corsHeaders });
  } catch (error) {
    creatorDigitalFilesLogger.error({ err: String(error) }, "Error fetching digital files:");
    return NextResponse.json(
      { error: "Failed to fetch digital files" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST: Create a new digital file (get presigned upload URL)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { projectId, fileName, fileSize, mimeType, name, description, accessType, rewardIds, addonIds } = body;

    if (!projectId || !fileName || !fileSize) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, fileName, fileSize" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify user owns or collaborates on this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404, headers: corsHeaders });
    }

    // Get storage settings
    const settings = await db.platformSettings.findFirst({
      select: {
        r2Enabled: true,
        digitalDownloadsEnabled: true,
        maxFileSizeMB: true,
        maxProjectStorageMB: true,
        allowedFileTypes: true,
      },
    });

    if (!settings?.r2Enabled || !settings?.digitalDownloadsEnabled) {
      return NextResponse.json(
        { error: "Digital downloads are not enabled" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate file size
    // Digital files use a 2GB limit (matching nginx/Next.js config)
    // The shared maxFileSizeMB setting (default 50MB) is for marketplace files
    const DIGITAL_FILE_MAX_MB = 2048;
    const maxBytes = DIGITAL_FILE_MAX_MB * 1024 * 1024;
    if (fileSize > maxBytes) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${DIGITAL_FILE_MAX_MB}MB` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate file type
    const allowedTypes = (settings.allowedFileTypes || "pdf,epub,zip,mp3").split(",").map((t: string) => t.trim());
    const fileExt = fileName.split(".").pop()?.toLowerCase();
    if (!fileExt || !allowedTypes.includes(fileExt)) {
      return NextResponse.json(
        { error: `File type not allowed. Allowed: ${allowedTypes.join(", ")}` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check project storage limit
    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500, headers: corsHeaders });
    }

    const currentUsage = await r2.getProjectStorageUsed(projectId);
    const maxProjectBytes = (settings.maxProjectStorageMB || 10240) * 1024 * 1024;
    if (currentUsage + fileSize > maxProjectBytes) {
      return NextResponse.json(
        { error: `Project storage limit exceeded (${settings.maxProjectStorageMB}MB max)` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Generate storage key and create file record
    const fileId = crypto.randomUUID();
    const storageKey = generateFileKey(projectId, fileName, fileId);

    // Create file record in database
    const digitalFile = await db.digitalFile.create({
      data: {
        id: fileId,
        projectId,
        name: name || fileName,
        description,
        fileName,
        fileUrl: "", // Will be updated after upload
        r2StorageKey: storageKey,
        fileSize,
        mimeType,
        accessType: accessType || "ALL_BACKERS",
        rewardIds: rewardIds || [],
        addonIds: addonIds || [],
        uploadedById: session.user.id,
      },
    });

    // Get presigned upload URL
    const uploadUrl = await r2.getUploadUrl(storageKey, {
      contentType: mimeType,
      expiresIn: 7200, // 2 hours for large file uploads
    });

    return NextResponse.json(
      {
        file: digitalFile,
        uploadUrl,
        storageKey,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    creatorDigitalFilesLogger.error({ err: String(error) }, "Error creating digital file:");
    return NextResponse.json(
      { error: "Failed to create digital file" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE: Remove a digital file
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json({ error: "File ID required" }, { status: 400, headers: corsHeaders });
    }

    // Get file and verify ownership
    const file = await db.digitalFile.findUnique({
      where: { id: fileId },
      include: {
        project: {
          select: {
            creatorId: true,
            collaborators: { where: { status: "ACCEPTED" }, select: { userId: true } },
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404, headers: corsHeaders });
    }

    const isOwner = file.project.creatorId === session.user.id;
    const isCollaborator = file.project.collaborators.some((c: { userId: string }) => c.userId === session.user.id);

    if (!isOwner && !isCollaborator) {
      return NextResponse.json({ error: "Access denied" }, { status: 403, headers: corsHeaders });
    }

    // Delete from R2 if storage key exists
    if (file.r2StorageKey) {
      const r2 = await getR2Storage();
      if (r2) {
        await r2.deleteFile(file.r2StorageKey);
      }
    }

    // Delete from database (cascades to distributions)
    await db.digitalFile.delete({
      where: { id: fileId },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    creatorDigitalFilesLogger.error({ err: String(error) }, "Error deleting digital file:");
    return NextResponse.json(
      { error: "Failed to delete digital file" },
      { status: 500, headers: corsHeaders }
    );
  }
}
