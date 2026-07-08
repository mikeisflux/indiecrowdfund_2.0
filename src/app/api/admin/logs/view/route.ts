import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

const viewLogger = logger.child({ module: "admin-logs-view" });

// Decompression with an output ceiling. A 10 MB gzip of repeated bytes
// can inflate ~1000x; without the cap a pathological archive could OOM
// the worker. zlib raises ERR_BUFFER_TOO_LARGE when the cap is hit.
const MAX_DECOMPRESSED_BYTES = 64 * 1024 * 1024; // 64 MB
function gunzipCapped(buf: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.gunzip(buf, { maxOutputLength: MAX_DECOMPRESSED_BYTES }, (err, out) =>
      err ? reject(err) : resolve(out)
    );
  });
}

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

// realpath-based: follows symlinks so the whitelist applies to the REAL
// target, not the lexical path (see ../route.ts for the full rationale).
// Returns the resolved path to read, or null if disallowed.
async function resolveAllowedPath(requested: string): Promise<string | null> {
  let real: string;
  try {
    real = await fs.promises.realpath(requested);
  } catch {
    return null;
  }
  for (const dir of LOG_DIRS) {
    if (path.dirname(real) === path.resolve(dir)) return real;
  }
  for (const f of STANDALONE_LOGS) {
    const base = path.resolve(f);
    if (real === base) return real;
    if (real.startsWith(base + ".")) {
      const suffix = real.slice(base.length + 1);
      if (/^(\d+(\.gz)?|gz)$/.test(suffix)) return real;
    }
  }
  return null;
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
  const resolved = await resolveAllowedPath(filePath);
  if (!resolved) {
    return NextResponse.json({ error: "Path not in allowed log directories" }, { status: 403 });
  }
  try {
    const stat = await fs.promises.stat(resolved);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a regular file" }, { status: 400 });
    }
    let content: string;
    let truncatedFromStart = false;

    if (resolved.endsWith(".gz")) {
      // Gzipped log: must decompress entire file because gzip is not seekable.
      // Cap compressed size at 10 MB to keep this from blowing up memory --
      // anything bigger should be downloaded out-of-band.
      if (stat.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Compressed log too large to view (>10 MB compressed). SSH and gunzip locally." },
          { status: 413 }
        );
      }
      const compressed = await fs.promises.readFile(resolved);
      let decompressed: Buffer;
      try {
        decompressed = await gunzipCapped(compressed);
      } catch (gzErr) {
        if (gzErr instanceof Error && "code" in gzErr && gzErr.code === "ERR_BUFFER_TOO_LARGE") {
          return NextResponse.json(
            { error: "Compressed log expands past the 64 MB viewer limit. SSH and gunzip locally." },
            { status: 413 }
          );
        }
        throw gzErr;
      }
      const fullText = decompressed.toString("utf8");
      if (fullText.length > bytes) {
        content = fullText.slice(fullText.length - bytes);
        truncatedFromStart = true;
      } else {
        content = fullText;
      }
    } else {
      // Plain text: seek to end and read just the tail.
      const fd = await fs.promises.open(resolved, "r");
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
      path: resolved,
      size: stat.size,
      bytesReturned: Buffer.byteLength(content, "utf8"),
      truncatedFromStart,
      content,
    });
  } catch (err) {
    viewLogger.error(
      { err: err instanceof Error ? err.message : String(err), path: resolved },
      "Failed to read log file"
    );
    return NextResponse.json({ error: "Failed to read log" }, { status: 500 });
  }
}
