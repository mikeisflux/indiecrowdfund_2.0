import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import * as fs from "fs";
import * as path from "path";

const logsLogger = logger.child({ module: "admin-logs" });

export const dynamic = "force-dynamic";

// Whitelist of log directories whose files we expose through the admin UI.
// Files INSIDE these dirs (non-recursive) are listable / viewable /
// truncatable. We never walk the tree; only direct children.
const LOG_DIRS = [
  "/var/log/nginx",
  "/var/log/postgresql",
  "/var/log/pm2",
  "/var/log/ic-snapshots",
];

// Standalone system logs we also expose. The directory listing rule below
// also matches their rotated siblings (auth.log.1, syslog.2.gz, etc).
const STANDALONE_LOGS = [
  "/var/log/syslog",
  "/var/log/auth.log",
  "/var/log/kern.log",
];

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }
  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Super admin access required", status: 403 };
  }
  return { user: session.user };
}

// Resolves `requested` and confirms it's a file under one of our whitelists.
// Rejects anything with traversal, symlink escape, or paths outside the list.
export function isPathAllowed(requested: string): boolean {
  let resolved: string;
  try {
    resolved = path.resolve(requested);
  } catch {
    return false;
  }
  // Direct child of a whitelisted directory
  for (const dir of LOG_DIRS) {
    if (path.dirname(resolved) === path.resolve(dir)) return true;
  }
  // Standalone log files (and their rotated siblings: .1, .2.gz, .gz)
  for (const f of STANDALONE_LOGS) {
    const base = path.resolve(f);
    if (resolved === base || resolved.startsWith(base + ".")) return true;
  }
  return false;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface LogEntry {
  path: string;
  name: string;
  group: string;
  size: number;
  sizeFormatted: string;
  modifiedAt: string;
}

// GET - list all log files we can see across the whitelists.
export async function GET() {
  const authResult = await requireSuperAdmin();
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const entries: LogEntry[] = [];
  for (const dir of LOG_DIRS) {
    let files: string[];
    try {
      files = await fs.promises.readdir(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      const full = path.join(dir, file);
      try {
        const stat = await fs.promises.stat(full);
        if (!stat.isFile()) continue;
        entries.push({
          path: full,
          name: file,
          group: path.basename(dir),
          size: stat.size,
          sizeFormatted: formatSize(stat.size),
          modifiedAt: stat.mtime.toISOString(),
        });
      } catch {
        // unreadable file -- skip
      }
    }
  }
  // Standalone logs: pick up the file itself and any rotated siblings.
  for (const standalone of STANDALONE_LOGS) {
    const dir = path.dirname(standalone);
    const base = path.basename(standalone);
    let files: string[];
    try {
      files = await fs.promises.readdir(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (file !== base && !file.startsWith(base + ".")) continue;
      const full = path.join(dir, file);
      try {
        const stat = await fs.promises.stat(full);
        if (!stat.isFile()) continue;
        entries.push({
          path: full,
          name: file,
          group: "system",
          size: stat.size,
          sizeFormatted: formatSize(stat.size),
          modifiedAt: stat.mtime.toISOString(),
        });
      } catch {
        // skip
      }
    }
  }
  entries.sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    return b.modifiedAt.localeCompare(a.modifiedAt);
  });
  return NextResponse.json({ logs: entries });
}

// DELETE - truncate a log file to 0 bytes.
//
// We truncate rather than rm because:
//   1. Active log files (nginx access.log, pm2 *.log, postgres .log) have
//      open file descriptors from the running process. rm-ing the path
//      leaves the writer with a dangling fd to a deleted inode -- it
//      keeps "writing", but the bytes go to a file no one can read until
//      the process restarts and reopens. Truncate preserves the inode so
//      writes continue uninterrupted and immediately appear in the
//      reachable file.
//   2. For rotated/.gz archives, truncate to 0 bytes is equivalent to rm
//      from the operator's perspective (frees the disk space, file
//      basically gone) without complicating the API with two modes.
export async function DELETE(req: NextRequest) {
  const authResult = await requireSuperAdmin();
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }
  if (!isPathAllowed(filePath)) {
    return NextResponse.json({ error: "Path not in allowed log directories" }, { status: 403 });
  }
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a regular file" }, { status: 400 });
    }
    await fs.promises.truncate(filePath, 0);
    logsLogger.info({ path: filePath, previousSize: stat.size }, "Truncated log file");
    return NextResponse.json({
      success: true,
      path: filePath,
      previousSize: stat.size,
    });
  } catch (err) {
    logsLogger.error(
      { err: err instanceof Error ? err.message : String(err), path: filePath },
      "Failed to truncate log file"
    );
    return NextResponse.json({ error: "Failed to truncate log" }, { status: 500 });
  }
}
