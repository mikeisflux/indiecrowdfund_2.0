import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminDatabaseBackupRestoreLogger = logger.child({ module: "admin-database-backup-restore" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

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

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });

  if (user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Super Admin access required for database restore", status: 403 };
  }

  return { user: session.user };
}

// Parse DATABASE_URL for psql
function parseDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not configured");
  }

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
    database: database.split("?")[0],
    sslmode: url.includes("sslmode=require") ? "require" : undefined,
  };
}

// POST - Restore from an existing backup file
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await req.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    // Sanitize filename: strip path components and reject any shell-special characters
    const sanitizedFilename = path.basename(filename);
    if (!/^[\w.\-]+$/.test(sanitizedFilename)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }
    let filePath = path.join(BACKUP_DIR, sanitizedFilename);

    // Check if file exists
    try {
      await fs.promises.access(filePath);
    } catch {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    // Check if psql is available
    try {
      await execAsync("which psql");
    } catch {
      return NextResponse.json(
        {
          error: "psql not found",
          details:
            "PostgreSQL client tools are not installed on this server.",
        },
        { status: 500 }
      );
    }

    const dbConfig = parseDatabaseUrl();

    // If file is gzipped, decompress it first
    let tempFile: string | null = null;
    if (sanitizedFilename.endsWith(".gz")) {
      tempFile = path.join(BACKUP_DIR, `temp_restore_${Date.now()}.sql`);
      await execAsync(`gunzip -c "${filePath}" > "${tempFile}"`);
      filePath = tempFile;
    }

    // Build psql command
    const pgEnv = {
      ...process.env,
      PGPASSWORD: dbConfig.password,
    };

    // WARNING: This will restore the backup to the database
    // In a production environment, you might want to:
    // 1. Create a backup before restore
    // 2. Use a transaction
    // 3. Validate the backup file first
    const psqlCmd = `psql -h "${dbConfig.host}" -p "${dbConfig.port}" -U "${dbConfig.user}" -d "${dbConfig.database}" -f "${filePath}"`;

    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(psqlCmd, {
      env: pgEnv,
      timeout: 600000, // 10 minute timeout
    });
    const duration = Date.now() - startTime;

    // Clean up temp file if created
    if (tempFile) {
      await fs.promises.unlink(tempFile).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: "Database restored successfully",
      duration: `${(duration / 1000).toFixed(1)}s`,
      details: stderr || stdout,
    });
  } catch (error) {
    adminDatabaseBackupRestoreLogger.error({ err: String(error) }, "Error restoring backup:");
    return NextResponse.json(
      { error: "Failed to restore backup", details: String(error) },
      { status: 500 }
    );
  }
}

// PUT - Upload a new backup file
export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    await ensureBackupDir();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const validExtensions = [".sql", ".sql.gz"];
    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      return NextResponse.json(
        { error: "Invalid file type. Only .sql and .sql.gz files are allowed." },
        { status: 400 }
      );
    }

    // Sanitize filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = file.name.endsWith(".gz") ? ".sql.gz" : ".sql";
    const sanitizedName = `uploaded_${timestamp}${extension}`;
    const filePath = path.join(BACKUP_DIR, sanitizedName);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.promises.writeFile(filePath, buffer);

    // Get file stats
    const stats = await fs.promises.stat(filePath);
    const sizeInMB = stats.size / (1024 * 1024);
    const sizeStr =
      sizeInMB >= 1
        ? `${sizeInMB.toFixed(2)} MB`
        : `${(stats.size / 1024).toFixed(2)} KB`;

    return NextResponse.json({
      success: true,
      backup: {
        id: sanitizedName,
        filename: sanitizedName,
        originalName: file.name,
        size: sizeStr,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    adminDatabaseBackupRestoreLogger.error({ err: String(error) }, "Error uploading backup:");
    return NextResponse.json(
      { error: "Failed to upload backup", details: String(error) },
      { status: 500 }
    );
  }
}
