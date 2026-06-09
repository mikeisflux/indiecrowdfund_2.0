import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { promisify } from "util";

const viewLogger = logger.child({ module: "admin-logs-view" });
const gunzip = promisify(zlib.gunzip);

export const dynamic = "force-dynamic";

// Same whitelist as ../route.ts. We don't import to avoid coupling the
// view endpoint to the list endpoint -- both must self-validate.
const LOG_DIRS = [
  "/var/log/nginx",
  "/var/log/postgresql",
  "/var/log/pm2",
  "/var/log/ic-snapshots",
];
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

function isPathAllowed(requested: string): boolean {
  let resolved: string;
  try {
    resolved = path.resolve(requested);
  } catch {
    return false;
  }
  for (const dir of LOG_DIRS) {
    if (path.dirname(resolved) === path.resolve(dir)) return true;
  }
  for (const f of STANDALONE_LOGS) {
    const base = path.resolve(f);
    if (resolved === base || resolved.startsWith(base + ".")) return true;
  }
  return false;
}

const DEFAULT_BYTES = 256 * 1024; // 256 KB
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB hard cap

export async function GET(req: NextRequest) {
  const authResult = await requireSuperAdmin();
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path");
  const requestedBytes = parseInt(searchParams.get("bytes") || "", 10);
  const bytes = Number.isFinite(requestedBytes) && requestedBytes > 0
    ? Math.min(requestedBytes, MAX_BYTES)
    : DEFAULT_BYTES;
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
    let content: string;
    let truncatedFromStart = false;

    if (filePath.endsWith(".gz")) {
      // Gzipped log: must decompress entire file because gzip is not seekable.
      // Cap compressed size at 10 MB to keep this from blowing up memory --
      // anything bigger should be downloaded out-of-band.
      if (stat.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Compressed log too large to view (>10 MB compressed). SSH and gunzip locally." },
          { status: 413 }
        );
      }
      const compressed = await fs.promises.readFile(filePath);
      const decompressed = await gunzip(compressed);
      const fullText = decompressed.toString("utf8");
      if (fullText.length > bytes) {
        content = fullText.slice(fullText.length - bytes);
        truncatedFromStart = true;
      } else {
        content = fullText;
      }
    } else {
      // Plain text: seek to end and read just the tail.
      const fd = await fs.promises.open(filePath, "r");
      try {
        if (stat.size > bytes) {
          const buffer = Buffer.alloc(bytes);
          await fd.read(buffer, 0, bytes, stat.size - bytes);
          // The first line is almost certainly partial (we seeked into the
          // middle of it). Drop it so we don't show a garbled head.
          const decoded = buffer.toString("utf8");
          const firstNewline = decoded.indexOf("\n");
          content = firstNewline >= 0 ? decoded.slice(firstNewline + 1) : decoded;
          truncatedFromStart = true;
        } else {
          const buffer = Buffer.alloc(stat.size);
          await fd.read(buffer, 0, stat.size, 0);
          content = buffer.toString("utf8");
        }
      } finally {
        await fd.close();
      }
    }
    return NextResponse.json({
      path: filePath,
      size: stat.size,
      bytesReturned: Buffer.byteLength(content, "utf8"),
      truncatedFromStart,
      content,
    });
  } catch (err) {
    viewLogger.error(
      { err: err instanceof Error ? err.message : String(err), path: filePath },
      "Failed to read log file"
    );
    return NextResponse.json({ error: "Failed to read log" }, { status: 500 });
  }
}
