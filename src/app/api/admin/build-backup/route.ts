import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

// Determine build directory - check common locations
function getBuildDir(): string {
  // Prefer explicit env var
  if (process.env.APP_ROOT) return process.env.APP_ROOT;

  // Try to determine from __dirname or process.cwd()
  const cwd = process.cwd();
  if (cwd.includes("indiecrowdfund")) return cwd;

  // Fallback to common paths
  return "/root/indiecrowdfund_2.0";
}

const BUILD_DIR = getBuildDir();

// Helper to check admin access
async function checkAdminAccess() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user, session };
}

// GET - List all build backups
export async function GET() {
  try {
    const accessCheck = await checkAdminAccess();
    if ("error" in accessCheck) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.status }
      );
    }

    // Find all .next-backup-* directories
    let entries;
    try {
      entries = await fs.readdir(BUILD_DIR, { withFileTypes: true });
    } catch (dirError) {
      console.error(`Cannot read build directory: ${BUILD_DIR}`, dirError);
      return NextResponse.json({
        backups: [],
        buildDir: BUILD_DIR,
        error: `Build directory not accessible: ${BUILD_DIR}`,
      });
    }
    const backups: { name: string; timestamp: string; size: string; createdAt: string }[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(".next-backup-")) {
        const backupPath = path.join(BUILD_DIR, entry.name);

        // Parse timestamp from directory name: .next-backup-YYYYMMDD_HHMMSS
        const timestampMatch = entry.name.match(/\.next-backup-(\d{8})_(\d{6})/);
        let formattedDate = "Unknown";

        if (timestampMatch) {
          const dateStr = timestampMatch[1]; // YYYYMMDD
          const timeStr = timestampMatch[2]; // HHMMSS
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          const hour = timeStr.substring(0, 2);
          const minute = timeStr.substring(2, 4);
          const second = timeStr.substring(4, 6);
          formattedDate = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        }

        // Calculate directory size (approximate)
        const size = await getDirectorySize(backupPath);

        backups.push({
          name: entry.name,
          timestamp: timestampMatch ? `${timestampMatch[1]}_${timestampMatch[2]}` : entry.name,
          size: formatBytes(size),
          createdAt: formattedDate,
        });
      }
    }

    // Sort by name descending (newest first)
    backups.sort((a, b) => b.name.localeCompare(a.name));

    return NextResponse.json({
      backups,
      buildDir: BUILD_DIR,
    });
  } catch (error) {
    console.error("Error listing build backups:", error);
    return NextResponse.json(
      { error: "Failed to list build backups" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a build backup
export async function DELETE(req: NextRequest) {
  try {
    const accessCheck = await checkAdminAccess();
    if ("error" in accessCheck) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const backupName = searchParams.get("name");

    if (!backupName) {
      return NextResponse.json(
        { error: "Backup name is required" },
        { status: 400 }
      );
    }

    // Validate backup name format to prevent path traversal
    if (!backupName.match(/^\.next-backup-\d{8}_\d{6}$/)) {
      return NextResponse.json(
        { error: "Invalid backup name format" },
        { status: 400 }
      );
    }

    const backupPath = path.join(BUILD_DIR, backupName);

    // Check if backup exists
    try {
      await fs.access(backupPath);
    } catch {
      return NextResponse.json(
        { error: "Backup not found" },
        { status: 404 }
      );
    }

    // Remove the backup directory
    await fs.rm(backupPath, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      message: `Deleted backup: ${backupName}`,
    });
  } catch (error) {
    console.error("Error deleting build backup:", error);
    return NextResponse.json(
      { error: "Failed to delete build backup" },
      { status: 500 }
    );
  }
}

// Helper to calculate directory size recursively
async function getDirectorySize(dirPath: string): Promise<number> {
  let size = 0;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isFile()) {
        const stats = await fs.stat(entryPath);
        size += stats.size;
      } else if (entry.isDirectory()) {
        size += await getDirectorySize(entryPath);
      }
    }
  } catch {
    // Ignore errors for inaccessible files
  }

  return size;
}

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
