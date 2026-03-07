import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminDatabaseBackupDownloadLogger = logger.child({ module: "admin-database-backup-download" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

const BACKUP_DIR = path.join(process.cwd(), "backups", "database");

// Helper to check admin role
async function requireAdmin() {
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

  return { user: session.user };
}

// GET - Download a backup file
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(BACKUP_DIR, sanitizedFilename);

    // Check if file exists
    try {
      await fs.promises.access(filePath);
    } catch {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    // Get file stats
    const stats = await fs.promises.stat(filePath);

    // Read file and stream it
    const fileBuffer = await fs.promises.readFile(filePath);

    // Determine content type
    const isGzipped = sanitizedFilename.endsWith(".gz");
    const contentType = isGzipped
      ? "application/gzip"
      : "application/sql";

    // Return the file as a download
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${sanitizedFilename}"`,
        "Content-Length": String(stats.size),
      },
    });
  } catch (error) {
    adminDatabaseBackupDownloadLogger.error({ err: String(error) }, "Error downloading backup:");
    return NextResponse.json(
      { error: "Failed to download backup", details: String(error) },
      { status: 500 }
    );
  }
}
