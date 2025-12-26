import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getR2Storage } from "@/lib/r2";

// CORS headers for API responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET: List all digital files accessible to the backer
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    // Get all valid pledges for the user
    const pledges = await prisma.pledge.findMany({
      where: {
        userId: session.user.id,
        status: "COMPLETED",
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            mainImage: true,
            status: true,
          },
        },
        reward: {
          select: {
            id: true,
            title: true,
          },
        },
        addons: {
          select: {
            id: true,
            addonId: true,
          },
        },
      },
    });

    // Get project IDs from pledges
    const projectIds = [...new Set(pledges.map((p) => p.projectId))];

    if (projectIds.length === 0) {
      return NextResponse.json({ files: [], projects: [] }, { headers: corsHeaders });
    }

    // Get all digital files for these projects
    const allFiles = await prisma.digitalFile.findMany({
      where: {
        projectId: { in: projectIds },
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            mainImage: true,
          },
        },
        _count: {
          select: { distributions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter files based on access control
    const accessibleFiles = allFiles.filter((file) => {
      // Find the pledge for this project
      const pledge = pledges.find((p) => p.projectId === file.projectId);
      if (!pledge) return false;

      switch (file.accessType) {
        case "ALL_BACKERS":
          return true;

        case "SPECIFIC_REWARDS":
          return pledge.rewardId && file.rewardIds.includes(pledge.rewardId);

        case "SPECIFIC_ADDONS":
          const pledgeAddonIds = pledge.addons.map((a) => a.addonId);
          return file.addonIds.some((addonId) => pledgeAddonIds.includes(addonId));

        case "REWARD_AND_ADDON":
          const hasReward = pledge.rewardId && file.rewardIds.includes(pledge.rewardId);
          const pledgeAddons = pledge.addons.map((a) => a.addonId);
          const hasAddon = file.addonIds.some((addonId) => pledgeAddons.includes(addonId));
          return hasReward || hasAddon;

        default:
          return true;
      }
    });

    // Get download status for these files
    const distributions = await prisma.digitalDistribution.findMany({
      where: {
        digitalFileId: { in: accessibleFiles.map((f) => f.id) },
        pledgeId: { in: pledges.map((p) => p.id) },
      },
    });

    // Enrich files with download status
    const filesWithStatus = accessibleFiles.map((file) => {
      const pledge = pledges.find((p) => p.projectId === file.projectId);
      const distribution = distributions.find(
        (d) => d.digitalFileId === file.id && pledge && d.pledgeId === pledge.id
      );

      return {
        ...file,
        downloadedAt: distribution?.downloadedAt,
        downloadCount: distribution?.downloadCount || 0,
        isNew: !distribution?.downloadedAt,
      };
    });

    // Group by project for UI
    const projectsWithFiles = projectIds.map((pid) => {
      const project = pledges.find((p) => p.projectId === pid)?.project;
      const files = filesWithStatus.filter((f) => f.projectId === pid);
      return {
        ...project,
        files,
        fileCount: files.length,
        newFileCount: files.filter((f) => f.isNew).length,
      };
    }).filter((p) => p.fileCount > 0);

    return NextResponse.json(
      {
        files: filesWithStatus,
        projects: projectsWithFiles,
        totalFiles: filesWithStatus.length,
        newFiles: filesWithStatus.filter((f) => f.isNew).length,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error fetching backer digital files:", error);
    return NextResponse.json(
      { error: "Failed to fetch digital files" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST: Get a presigned download URL for a file
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json({ error: "File ID required" }, { status: 400, headers: corsHeaders });
    }

    // Get the file
    const file = await prisma.digitalFile.findUnique({
      where: { id: fileId },
      include: {
        project: {
          select: { id: true, title: true },
        },
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404, headers: corsHeaders });
    }

    // Get user's pledge for this project
    const pledge = await prisma.pledge.findFirst({
      where: {
        userId: session.user.id,
        projectId: file.projectId,
        status: "COMPLETED",
      },
      include: {
        addons: {
          select: { addonId: true },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json(
        { error: "No valid pledge found for this project" },
        { status: 403, headers: corsHeaders }
      );
    }

    // Check access based on file access type
    let hasAccess = false;
    switch (file.accessType) {
      case "ALL_BACKERS":
        hasAccess = true;
        break;

      case "SPECIFIC_REWARDS":
        hasAccess = pledge.rewardId !== null && file.rewardIds.includes(pledge.rewardId);
        break;

      case "SPECIFIC_ADDONS":
        const pledgeAddonIds = pledge.addons.map((a) => a.addonId);
        hasAccess = file.addonIds.some((addonId) => pledgeAddonIds.includes(addonId));
        break;

      case "REWARD_AND_ADDON":
        const hasReward = pledge.rewardId !== null && file.rewardIds.includes(pledge.rewardId);
        const pledgeAddons = pledge.addons.map((a) => a.addonId);
        const hasAddon = file.addonIds.some((addonId) => pledgeAddons.includes(addonId));
        hasAccess = hasReward || hasAddon;
        break;

      default:
        hasAccess = true;
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You do not have access to this file" },
        { status: 403, headers: corsHeaders }
      );
    }

    // Get presigned download URL
    if (!file.r2StorageKey) {
      // Legacy file without R2 storage - return direct URL
      return NextResponse.json(
        {
          downloadUrl: file.fileUrl,
          fileName: file.fileName,
          fileSize: file.fileSize,
        },
        { headers: corsHeaders }
      );
    }

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500, headers: corsHeaders });
    }

    // Get signed URL expiration from settings
    const settings = await prisma.platformSettings.findFirst({
      select: { signedUrlExpirationMinutes: true },
    });
    const expiresIn = (settings?.signedUrlExpirationMinutes || 60) * 60;

    const downloadUrl = await r2.getDownloadUrl(file.r2StorageKey, { expiresIn });

    // Update or create distribution record
    await prisma.digitalDistribution.upsert({
      where: {
        digitalFileId_pledgeId: {
          digitalFileId: file.id,
          pledgeId: pledge.id,
        },
      },
      update: {
        downloadedAt: new Date(),
        downloadCount: { increment: 1 },
      },
      create: {
        digitalFileId: file.id,
        pledgeId: pledge.id,
        distributedAt: new Date(),
        downloadedAt: new Date(),
        downloadCount: 1,
      },
    });

    // Update file download count
    await prisma.digitalFile.update({
      where: { id: file.id },
      data: { downloadCount: { increment: 1 } },
    });

    return NextResponse.json(
      {
        downloadUrl,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        expiresIn,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error generating download URL:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500, headers: corsHeaders }
    );
  }
}
