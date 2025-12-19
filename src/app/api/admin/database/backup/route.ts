import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

// Backup directory - stored in project root
const BACKUP_DIR = path.join(process.cwd(), "backups", "database");

// Ensure backup directory exists
async function ensureBackupDir() {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
}

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

// Parse DATABASE_URL for pg_dump
function parseDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not configured");
  }

  // Parse PostgreSQL connection string
  // Format: postgresql://user:password@host:port/database?sslmode=...
  const match = url.match(
    /postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/([^?]+)/
  );

  if (!match) {
    throw new Error("Invalid DATABASE_URL format");
  }

  const [, user, password, host, port, database] = match;

  return {
    user: decodeURIComponent(user),
    password: decodeURIComponent(password),
    host,
    port: port || "5432",
    database: database.split("?")[0], // Remove query params
    sslmode: url.includes("sslmode=require") ? "require" : undefined,
  };
}

// GET - List all backups
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    await ensureBackupDir();

    // Read backup directory
    const files = await fs.promises.readdir(BACKUP_DIR);
    const backups = [];

    for (const file of files) {
      if (file.endsWith(".sql") || file.endsWith(".sql.gz")) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = await fs.promises.stat(filePath);

        // Format size
        const sizeInMB = stats.size / (1024 * 1024);
        const sizeStr =
          sizeInMB >= 1
            ? `${sizeInMB.toFixed(2)} MB`
            : `${(stats.size / 1024).toFixed(2)} KB`;

        backups.push({
          id: file,
          filename: file,
          size: sizeStr,
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString(),
          createdAtFormatted: formatRelativeTime(stats.mtime),
        });
      }
    }

    // Sort by date, newest first
    backups.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ backups });
  } catch (error) {
    console.error("Error listing backups:", error);
    return NextResponse.json(
      { error: "Failed to list backups", details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Create a new backup
export async function POST(_req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    await ensureBackupDir();

    // Check if pg_dump is available
    try {
      await execAsync("which pg_dump");
    } catch {
      return NextResponse.json(
        {
          error: "pg_dump not found",
          details:
            "PostgreSQL client tools are not installed on this server. Please install postgresql-client.",
        },
        { status: 500 }
      );
    }

    const dbConfig = parseDatabaseUrl();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup_${timestamp}.sql`;
    const filePath = path.join(BACKUP_DIR, filename);

    // Build pg_dump command
    // Using environment variable for password to avoid command line exposure
    const pgDumpEnv = {
      ...process.env,
      PGPASSWORD: dbConfig.password,
    };

    const pgDumpCmd = `pg_dump -h "${dbConfig.host}" -p "${dbConfig.port}" -U "${dbConfig.user}" -d "${dbConfig.database}" --no-owner --no-acl -f "${filePath}"`;

    // Run pg_dump
    const startTime = Date.now();
    await execAsync(pgDumpCmd, { env: pgDumpEnv, timeout: 300000 }); // 5 minute timeout
    const duration = Date.now() - startTime;

    // Get file stats
    const stats = await fs.promises.stat(filePath);
    const sizeInMB = stats.size / (1024 * 1024);
    const sizeStr =
      sizeInMB >= 1
        ? `${sizeInMB.toFixed(2)} MB`
        : `${(stats.size / 1024).toFixed(2)} KB`;

    // Optionally compress with gzip if file is large
    let finalFilename = filename;
    let finalPath = filePath;
    let finalSize = sizeStr;

    if (sizeInMB > 10) {
      // Compress if > 10MB
      try {
        await execAsync(`gzip "${filePath}"`);
        finalFilename = `${filename}.gz`;
        finalPath = `${filePath}.gz`;
        const gzStats = await fs.promises.stat(finalPath);
        const gzSizeInMB = gzStats.size / (1024 * 1024);
        finalSize =
          gzSizeInMB >= 1
            ? `${gzSizeInMB.toFixed(2)} MB`
            : `${(gzStats.size / 1024).toFixed(2)} KB`;
      } catch (gzipError) {
        console.warn("Gzip compression failed, keeping uncompressed:", gzipError);
      }
    }

    return NextResponse.json({
      success: true,
      backup: {
        id: finalFilename,
        filename: finalFilename,
        size: finalSize,
        createdAt: new Date().toISOString(),
        duration: `${(duration / 1000).toFixed(1)}s`,
      },
    });
  } catch (error) {
    console.error("Error creating backup:", error);
    return NextResponse.json(
      { error: "Failed to create backup", details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Delete a backup
export async function DELETE(req: NextRequest) {
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

    // Delete the file
    await fs.promises.unlink(filePath);

    return NextResponse.json({ success: true, deleted: sanitizedFilename });
  } catch (error) {
    console.error("Error deleting backup:", error);
    return NextResponse.json(
      { error: "Failed to delete backup", details: String(error) },
      { status: 500 }
    );
  }
}

// Helper function to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString();
}
