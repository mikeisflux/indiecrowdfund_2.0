import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminBuildBackupDownloadLogger = logger.child({ module: "admin-build-backup-download" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

// Determine build directory - must match the list endpoint logic
function getBuildDir(): string {
  if (process.env.APP_ROOT) return process.env.APP_ROOT;
  const cwd = process.cwd();
  if (cwd.includes("indiecrowdfund")) return cwd;
  return "/root/indiecrowdfund_2.0";
}

const BUILD_DIR = getBuildDir();

// GET - Download a build backup as tar.gz
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
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

    const backupPath = path.join(/*turbopackIgnore: true*/ BUILD_DIR, backupName);

    // Check if backup exists
    if (!existsSync(/*turbopackIgnore: true*/ backupPath)) {
      return NextResponse.json(
        { error: "Backup not found" },
        { status: 404 }
      );
    }

    // Create a temporary tar.gz file
    const tmpFile = `/tmp/${backupName}.tar.gz`;

    try {
      // Create tar.gz archive using system tar command. Exclude the
      // regenerable cache dir (.next/cache: webpack build cache + the
      // on-demand Image Optimizer cache) — it's the bulk of the on-disk
      // size, isn't needed to restore a build, and rebuilds lazily. This
      // keeps downloads small even for older backups taken before the
      // build-and-swap script started pruning cache at backup time.
      await execAsync(
        `tar --exclude="${backupName}/cache" -czf "${tmpFile}" -C "${BUILD_DIR}" "${backupName}"`
      );

      // Read the file
      const fileBuffer = await fs.readFile(tmpFile);

      // Clean up temp file
      await fs.unlink(tmpFile).catch(() => {});

      // Return the file
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="${backupName}.tar.gz"`,
          "Content-Length": fileBuffer.length.toString(),
          "Cache-Control": "no-store",
        },
      });
    } catch (tarError) {
      adminBuildBackupDownloadLogger.error({ err: String(tarError) }, "Error creating tar archive:");
      // Clean up temp file on error
      await fs.unlink(tmpFile).catch(() => {});
      throw tarError;
    }
  } catch (error) {
    adminBuildBackupDownloadLogger.error({ err: formatError(error) }, "Error downloading build backup:");
    return NextResponse.json(
      { error: "Failed to download backup" },
      { status: 500 }
    );
  }
}
