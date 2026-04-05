import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminMediaScanLogger = logger.child({ module: "admin-media-scan" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { readdir, stat } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true }
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: { ...session.user, id: user.id } };
}

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
};

// Recursively scan a directory for files
async function scanDirectory(dir: string, baseDir: string): Promise<Array<{
  path: string;
  relativePath: string;
  filename: string;
  size: number;
  mimeType: string;
}>> {
  const results: Array<{
    path: string;
    relativePath: string;
    filename: string;
    size: number;
    mimeType: string;
  }> = [];

  if (!existsSync(dir)) {
    return results;
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subResults = await scanDirectory(fullPath, baseDir);
        results.push(...subResults);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const mimeType = MIME_TYPES[ext];

        if (mimeType) {
          const stats = await stat(fullPath);
          const relativePath = path.relative(baseDir, fullPath);

          results.push({
            path: fullPath,
            relativePath,
            filename: entry.name,
            size: stats.size,
            mimeType,
          });
        }
      }
    }
  } catch (error) {
    adminMediaScanLogger.error({ err: String(error) }, `Error scanning directory ${dir}:`);
  }

  return results;
}

// GET - Scan for existing files and database images
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "scan";

    // Scan the uploads directory for files
    const uploadsDir = path.join(process.cwd(), "uploads");
    const publicUploadsDir = path.join(process.cwd(), "public", "uploads");

    const filesystemFiles = [
      ...(await scanDirectory(uploadsDir, uploadsDir)),
      ...(await scanDirectory(publicUploadsDir, publicUploadsDir)),
    ];

    // Get existing MediaFile URLs to avoid duplicates
    const existingMediaFiles = await db.mediaFile.findMany({
      select: { url: true }
    });
    const existingUrls = new Set(existingMediaFiles.map((m: { url: string }) => m.url));

    // Get image URLs from projects
    const projectImages = await db.project.findMany({
      where: { imageUrl: { not: null } },
      select: { id: true, title: true, imageUrl: true, creatorId: true }
    });

    // Get image URLs from updates
    const updateImages = await db.update.findMany({
      where: { imageUrl: { not: null } },
      select: { id: true, title: true, imageUrl: true, project: { select: { creatorId: true } } }
    });

    // Get image URLs from rewards
    const rewardImages = await db.reward.findMany({
      where: { imageUrl: { not: null } },
      select: { id: true, title: true, imageUrl: true, project: { select: { creatorId: true } } }
    });

    // Combine all database image references
    const databaseImages: Array<{
      source: string;
      sourceId: string;
      title: string;
      url: string;
      uploaderId: string | null;
    }> = [
      ...projectImages.map(p => ({
        source: "project",
        sourceId: p.id,
        title: p.title,
        url: p.imageUrl as string,
        uploaderId: p.creatorId
      })),
      ...updateImages.map(u => ({
        source: "update",
        sourceId: u.id,
        title: u.title,
        url: u.imageUrl as string,
        uploaderId: u.project.creatorId
      })),
      ...rewardImages.map(r => ({
        source: "reward",
        sourceId: r.id,
        title: r.title,
        url: r.imageUrl as string,
        uploaderId: r.project.creatorId
      })),
    ];

    // Filter to only local URLs that aren't already tracked
    const untracked = {
      filesystem: filesystemFiles.filter(f => {
        const url = `/api/uploads/${f.relativePath}`;
        return !existingUrls.has(url);
      }),
      database: databaseImages.filter(d => {
        // Only include local URLs (starting with / or /api/)
        const isLocal = d.url.startsWith("/") && !d.url.startsWith("//");
        return isLocal && !existingUrls.has(d.url);
      })
    };

    // Count already tracked
    const tracked = {
      filesystem: filesystemFiles.length - untracked.filesystem.length,
      database: databaseImages.length - untracked.database.length
    };

    return NextResponse.json({
      scanned: {
        filesystemTotal: filesystemFiles.length,
        databaseTotal: databaseImages.length,
        alreadyTracked: tracked,
        untracked: {
          filesystem: untracked.filesystem.length,
          database: untracked.database.length
        }
      },
      untrackedFiles: action === "details" ? untracked : undefined
    });
  } catch (error) {
    adminMediaScanLogger.error({ err: String(error) }, "Error scanning for media:");
    return NextResponse.json(
      { error: "Failed to scan for media" },
      { status: 500 }
    );
  }
}

// POST - Import scanned files into MediaFile table
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const importSource = searchParams.get("source") || "all"; // "filesystem", "database", or "all"

    // Get existing MediaFile URLs to avoid duplicates
    const existingMediaFiles = await db.mediaFile.findMany({
      select: { url: true }
    });
    const existingUrls = new Set(existingMediaFiles.map((m: { url: string }) => m.url));

    let imported = 0;
    const errors: string[] = [];

    // Import filesystem files
    if (importSource === "filesystem" || importSource === "all") {
      const uploadsDir = path.join(process.cwd(), "uploads");
      const publicUploadsDir = path.join(process.cwd(), "public", "uploads");

      const filesystemFiles = [
        ...(await scanDirectory(uploadsDir, uploadsDir)).map(f => ({
          ...f,
          baseUrl: "/api/uploads"
        })),
        ...(await scanDirectory(publicUploadsDir, publicUploadsDir)).map(f => ({
          ...f,
          baseUrl: "/uploads"
        })),
      ];

      for (const file of filesystemFiles) {
        const url = `${file.baseUrl}/${file.relativePath}`;
        if (existingUrls.has(url)) continue;

        try {
          await db.mediaFile.create({
            data: {
              uploaderId: authResult.user.id,
              filename: file.filename,
              originalName: file.filename,
              mimeType: file.mimeType,
              size: file.size,
              url,
              thumbnailUrl: file.mimeType.startsWith("image") ? url : null,
              folder: "imported",
              tags: ["imported", "filesystem"],
            }
          });
          imported++;
          existingUrls.add(url);
        } catch (err) {
          errors.push(`Failed to import ${file.filename}: ${err}`);
        }
      }
    }

    // Import database image URLs
    if (importSource === "database" || importSource === "all") {
      // Get image URLs from projects
      const projectImages = await db.project.findMany({
        where: { imageUrl: { not: null } },
        select: { id: true, title: true, imageUrl: true, creatorId: true }
      });

      // Get image URLs from updates
      const updateImages = await db.update.findMany({
        where: { imageUrl: { not: null } },
        select: { id: true, title: true, imageUrl: true, project: { select: { creatorId: true } } }
      });

      // Get image URLs from rewards
      const rewardImages = await db.reward.findMany({
        where: { imageUrl: { not: null } },
        select: { id: true, title: true, imageUrl: true, project: { select: { creatorId: true } } }
      });

      const allDbImages = [
        ...projectImages.map(p => ({
          url: p.imageUrl as string,
          name: `project-${p.title}`,
          uploaderId: p.creatorId,
          tag: `project:${p.id}`
        })),
        ...updateImages.map(u => ({
          url: u.imageUrl as string,
          name: `update-${u.title}`,
          uploaderId: u.project.creatorId,
          tag: `update:${u.id}`
        })),
        ...rewardImages.map(r => ({
          url: r.imageUrl as string,
          name: `reward-${r.title}`,
          uploaderId: r.project.creatorId,
          tag: `reward:${r.id}`
        })),
      ];

      for (const img of allDbImages) {
        // Only process local URLs
        const isLocal = img.url.startsWith("/") && !img.url.startsWith("//");
        if (!isLocal || existingUrls.has(img.url)) continue;

        try {
          // Infer MIME type from URL extension
          const ext = path.extname(img.url).toLowerCase();
          const mimeType = MIME_TYPES[ext] || "image/jpeg";
          const filename = path.basename(img.url);

          await db.mediaFile.create({
            data: {
              uploaderId: img.uploaderId,
              filename,
              originalName: img.name,
              mimeType,
              size: 0, // We don't know the size without reading the file
              url: img.url,
              thumbnailUrl: mimeType.startsWith("image") ? img.url : null,
              folder: "projects",
              tags: ["imported", "database", img.tag],
            }
          });
          imported++;
          existingUrls.add(img.url);
        } catch (err) {
          errors.push(`Failed to import ${img.url}: ${err}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    adminMediaScanLogger.error({ err: String(error) }, "Error importing media:");
    return NextResponse.json(
      { error: "Failed to import media" },
      { status: 500 }
    );
  }
}
