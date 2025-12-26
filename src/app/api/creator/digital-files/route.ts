import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getR2Storage, generateFileKey, validateFileType } from "@/lib/r2";

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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400, headers: corsHeaders });
    }

    // Verify user owns or collaborates on this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id } } },
        ],
      },
      select: { id: true, title: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404, headers: corsHeaders });
    }

    const files = await prisma.digitalFile.findMany({
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
    console.error("Error fetching digital files:", error);
    return NextResponse.json(
      { error: "Failed to fetch digital files" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST: Create a new digital file (get presigned upload URL)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
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
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404, headers: corsHeaders });
    }

    // Get storage settings
    const settings = await prisma.platformSettings.findFirst({
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
    const maxBytes = (settings.maxFileSizeMB || 50) * 1024 * 1024;
    if (fileSize > maxBytes) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${settings.maxFileSizeMB}MB` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate file type
    const allowedTypes = (settings.allowedFileTypes || "pdf,epub,zip,mp3").split(",").map((t) => t.trim());
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
    const maxProjectBytes = (settings.maxProjectStorageMB || 200) * 1024 * 1024;
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
    const digitalFile = await prisma.digitalFile.create({
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
      expiresIn: 3600,
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
    console.error("Error creating digital file:", error);
    return NextResponse.json(
      { error: "Failed to create digital file" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE: Remove a digital file
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json({ error: "File ID required" }, { status: 400, headers: corsHeaders });
    }

    // Get file and verify ownership
    const file = await prisma.digitalFile.findUnique({
      where: { id: fileId },
      include: {
        project: {
          select: {
            creatorId: true,
            collaborators: { select: { userId: true } },
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404, headers: corsHeaders });
    }

    const isOwner = file.project.creatorId === session.user.id;
    const isCollaborator = file.project.collaborators.some((c) => c.userId === session.user.id);

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
    await prisma.digitalFile.delete({
      where: { id: fileId },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error deleting digital file:", error);
    return NextResponse.json(
      { error: "Failed to delete digital file" },
      { status: 500, headers: corsHeaders }
    );
  }
}
