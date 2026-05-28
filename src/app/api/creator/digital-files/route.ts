import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorDigitalFilesLogger = logger.child({ module: "creator-digital-files" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getR2Storage, generateFileKey } from "@/lib/r2";
import { sendEmail } from "@/lib/email";

// CORS headers for API responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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
    creatorDigitalFilesLogger.error({ err: formatError(error) }, "Error fetching digital files:");
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
    creatorDigitalFilesLogger.error({ err: formatError(error) }, "Error creating digital file:");
    return NextResponse.json(
      { error: "Failed to create digital file" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PATCH: Replace a digital file (two-step: get upload URL, then confirm)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { action, fileId } = body;

    if (!fileId) {
      return NextResponse.json({ error: "File ID required" }, { status: 400, headers: corsHeaders });
    }

    // Verify ownership
    const file = await db.digitalFile.findUnique({
      where: { id: fileId },
      include: {
        project: {
          select: {
            id: true,
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

    // Step 1: get_replace_url — validate new file and return presigned upload URL
    if (action === "get_replace_url") {
      const { fileName, fileSize, mimeType } = body;

      if (!fileName || !fileSize) {
        return NextResponse.json({ error: "fileName and fileSize required" }, { status: 400, headers: corsHeaders });
      }

      const settings = await db.platformSettings.findFirst({
        select: { r2Enabled: true, digitalDownloadsEnabled: true, allowedFileTypes: true },
      });

      if (!settings?.r2Enabled || !settings?.digitalDownloadsEnabled) {
        return NextResponse.json({ error: "Digital downloads are not enabled" }, { status: 400, headers: corsHeaders });
      }

      const DIGITAL_FILE_MAX_MB = 2048;
      if (fileSize > DIGITAL_FILE_MAX_MB * 1024 * 1024) {
        return NextResponse.json({ error: `File size exceeds ${DIGITAL_FILE_MAX_MB}MB limit` }, { status: 400, headers: corsHeaders });
      }

      const allowedTypes = (settings.allowedFileTypes || "pdf,epub,zip,mp3").split(",").map((t: string) => t.trim());
      const fileExt = fileName.split(".").pop()?.toLowerCase();
      if (!fileExt || !allowedTypes.includes(fileExt)) {
        return NextResponse.json({ error: `File type not allowed. Allowed: ${allowedTypes.join(", ")}` }, { status: 400, headers: corsHeaders });
      }

      const r2 = await getR2Storage();
      if (!r2) {
        return NextResponse.json({ error: "Storage not configured" }, { status: 500, headers: corsHeaders });
      }

      // Generate a new storage key for the replacement file
      const newStorageKey = generateFileKey(file.project.id, fileName, crypto.randomUUID());
      const uploadUrl = await r2.getUploadUrl(newStorageKey, {
        contentType: mimeType,
        expiresIn: 7200,
      });

      // Count how many backers already have this file distributed
      const affectedCount = await db.digitalDistribution.count({
        where: { digitalFileId: fileId, distributedAt: { not: null } },
      });

      return NextResponse.json({ uploadUrl, newStorageKey, affectedCount }, { headers: corsHeaders });
    }

    // Step 2: confirm_replace — swap the file in DB and optionally notify backers
    if (action === "confirm_replace") {
      const { newStorageKey, fileName, fileSize, mimeType, notifyBackers } = body;

      if (!newStorageKey) {
        return NextResponse.json({ error: "newStorageKey required" }, { status: 400, headers: corsHeaders });
      }

      // Security: verify the key was generated for this project (prevents a creator from
      // pointing this DigitalFile at another project's R2 object by passing an arbitrary key)
      const expectedPrefix = `digital-rewards/${file.project.id}/`;
      if (!newStorageKey.startsWith(expectedPrefix)) {
        return NextResponse.json({ error: "Invalid storage key" }, { status: 400, headers: corsHeaders });
      }

      const r2 = await getR2Storage();

      // Swap the storage key and reset cover (new file may have different pages)
      const oldStorageKey = file.r2StorageKey;
      await db.digitalFile.update({
        where: { id: fileId },
        data: {
          r2StorageKey: newStorageKey,
          fileName: fileName || file.fileName,
          fileSize: fileSize || file.fileSize,
          mimeType: mimeType || file.mimeType,
          // Reset cover extraction so it gets re-extracted from the new file
          coverImageUrl: null,
          coverExtractedAt: null,
          coverExtractionFailed: false,
          updatedAt: new Date(),
        },
      });

      // Delete old file from R2
      if (oldStorageKey && r2) {
        await r2.deleteFile(oldStorageKey).catch((err: unknown) =>
          creatorDigitalFilesLogger.warn({ err: String(err), oldStorageKey }, "Failed to delete old R2 file after replacement")
        );
      }

      // Find all backers who received this file and send notification emails
      let notifiedCount = 0;
      if (notifyBackers) {
        // DigitalDistribution has no pledge relation — only pledgeId field.
        // Fetch distributions to get pledgeIds, then look up users via Pledge.
        const distributions = await db.digitalDistribution.findMany({
          where: { digitalFileId: fileId, distributedAt: { not: null } },
          select: { pledgeId: true },
        });

        const pledgeIds = distributions.map((d: { pledgeId: string }) => d.pledgeId);
        const pledges = pledgeIds.length > 0
          ? await db.pledge.findMany({
              where: { id: { in: pledgeIds } },
              select: { user: { select: { email: true, name: true, deletedAt: true } } },
            })
          : [];

        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";
        const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
        const escapeMap: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" };
        const safeFileName = file.name.replace(/[<>&"]/g, (c: string) => escapeMap[c] ?? c);
        const downloadsUrl = `${APP_URL}/dashboard/backer?tab=downloads`;

        const emailResults = await Promise.allSettled(
          pledges
            .filter((p) => p.user && !p.user.deletedAt && p.user.email)
            .map((p) => {
              const user = p.user!;
              const safeName = (user.name || "Backer").replace(/[<>&"]/g, (c: string) => escapeMap[c] ?? c);
              return sendEmail({
                to: user.email!,
                subject: `Updated file available: ${file.name}`,
                html: `
                  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                    <h2 style="color:#333;">Updated File Available</h2>
                    <p>Hi ${safeName},</p>
                    <p>The creator has uploaded a corrected version of <strong>${safeFileName}</strong>.</p>
                    <p>The updated file is now available in your digital downloads. Your reading progress has been preserved.</p>
                    <p style="margin:24px 0;">
                      <a href="${downloadsUrl}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
                        View Downloads
                      </a>
                    </p>
                    <p style="color:#666;font-size:12px;">— The ${APP_NAME} Team</p>
                  </div>
                `,
                text: `Hi ${user.name || "Backer"},\n\nThe creator has uploaded a corrected version of "${file.name}".\n\nThe updated file is now available in your digital downloads at: ${downloadsUrl}\n\n— The ${APP_NAME} Team`,
              });
            })
        );
        notifiedCount = emailResults.filter(r => r.status === "fulfilled").length;
        emailResults.forEach((r, i) => {
          if (r.status === "rejected") {
            creatorDigitalFilesLogger.warn({ err: String(r.reason), index: i }, "Failed to send replacement notification email");
          }
        });
      }

      const affectedCount = await db.digitalDistribution.count({
        where: { digitalFileId: fileId, distributedAt: { not: null } },
      });

      creatorDigitalFilesLogger.info({ fileId, affectedCount, notifiedCount }, "Digital file replaced");
      return NextResponse.json({ success: true, affectedCount, notifiedCount }, { headers: corsHeaders });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (error) {
    creatorDigitalFilesLogger.error({ err: formatError(error) }, "Error replacing digital file:");
    return NextResponse.json({ error: "Failed to replace digital file" }, { status: 500, headers: corsHeaders });
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

    // Delete from database (cascades to distributions).
    // deleteMany scoped to { id } — second caller on a concurrent delete
    // sees { count: 0 } instead of throwing P2025.
    await db.digitalFile.deleteMany({
      where: { id: fileId },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    creatorDigitalFilesLogger.error({ err: formatError(error) }, "Error deleting digital file:");
    return NextResponse.json(
      { error: "Failed to delete digital file" },
      { status: 500, headers: corsHeaders }
    );
  }
}
