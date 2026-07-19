import { NextResponse } from "next/server";
import fs from "fs";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  requireSuperAdmin,
  isPidAlive,
  PDF_FILENAME,
  PDF_PATH,
  LOG_PATH,
  PID_PATH,
} from "@/lib/copyright-capture";

const log = logger.child({ module: "admin-copyright-status" });

export const dynamic = "force-dynamic";

const TAIL_LINES = 200;

// GET — current capture state: whether it's running, the tail of its log, a
// captured-page count, and info about the finished PDF (if any).
export async function GET() {
  try {
    const gate = await requireSuperAdmin();
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    let pid: number | null = null;
    try {
      pid = parseInt(fs.readFileSync(PID_PATH, "utf8").trim(), 10);
    } catch {
      pid = null;
    }
    const running = isPidAlive(pid);

    let logText = "";
    try {
      const full = fs.readFileSync(LOG_PATH, "utf8");
      logText = full.split("\n").slice(-TAIL_LINES).join("\n");
    } catch {
      logText = "";
    }

    // Page count: prefer the script's summary line, else count OK/SKIP marks.
    let pageCount: number | null = null;
    const doneMatch = logText.match(/Done\.\s+(\d+)\s+page/i);
    if (doneMatch) {
      pageCount = parseInt(doneMatch[1], 10);
    } else {
      const marks = logText.match(/\]\s+(OK|SKIP)\b/g);
      if (marks) pageCount = marks.length;
    }

    let pdf: { exists: boolean; size: number; modified: string | null; filename: string } = {
      exists: false,
      size: 0,
      modified: null,
      filename: PDF_FILENAME,
    };
    try {
      const st = fs.statSync(PDF_PATH);
      pdf = { exists: true, size: st.size, modified: st.mtime.toISOString(), filename: PDF_FILENAME };
    } catch {
      // no PDF yet
    }

    return NextResponse.json({ running, pid: running ? pid : null, pageCount, log: logText, pdf });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to read copyright capture status");
    return NextResponse.json({ error: "Failed to read status" }, { status: 500 });
  }
}
