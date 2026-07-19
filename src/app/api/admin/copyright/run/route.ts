import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  requireSuperAdmin,
  isPidAlive,
  REPO_DIR,
  SCRIPT_PATH,
  OUT_DIR,
  RUN_DIR,
  LOG_PATH,
  PID_PATH,
} from "@/lib/copyright-capture";

const log = logger.child({ module: "admin-copyright-run" });

export const dynamic = "force-dynamic";

// POST — kick off a screenshot-every-page capture in the background. Output is
// streamed to a log file the /status route tails; the PDF lands where the
// /download route serves it from.
export async function POST(req: NextRequest) {
  try {
    const gate = await requireSuperAdmin();
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    if (!fs.existsSync(SCRIPT_PATH)) {
      return NextResponse.json(
        { error: `Capture script not found at ${SCRIPT_PATH}. Pull the latest code on the server.` },
        { status: 500 }
      );
    }

    // Refuse to start a second run on top of a live one.
    let existingPid: number | null = null;
    try {
      existingPid = parseInt(fs.readFileSync(PID_PATH, "utf8").trim(), 10);
    } catch {
      existingPid = null;
    }
    if (isPidAlive(existingPid)) {
      return NextResponse.json({ error: "A capture is already running." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const fresh = body?.fresh === true;
    const includeAuth = body?.includeAuth !== false; // default: capture logged-in pages too
    const rawBase = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";
    const baseUrl = rawBase || `http://127.0.0.1:${process.env.PORT || 3000}`;

    // Validate the base URL — it becomes a child-process env var.
    try {
      const u = new URL(baseUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("protocol");
    } catch {
      return NextResponse.json({ error: "Invalid base URL." }, { status: 400 });
    }

    fs.mkdirSync(RUN_DIR, { recursive: true });
    const startedAt = new Date().toISOString();
    fs.writeFileSync(
      LOG_PATH,
      `# Copyright capture started ${startedAt}\n# base=${baseUrl} includeAuth=${includeAuth} fresh=${fresh}\n\n`
    );

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      BASE_URL: baseUrl,
      OUT_DIR,
      FRESH: fresh ? "1" : "",
      // Never carry a stale password path into the run.
      IC_EMAIL: "",
      IC_PASSWORD: "",
    };
    // Forward the admin's own session cookie so the authenticated pass captures
    // the logged-in dashboards/admin as this user — no password handling.
    if (includeAuth) {
      env.IC_COOKIE = req.headers.get("cookie") || "";
    } else {
      env.IC_COOKIE = "";
    }

    // Detach so the capture outlives this request; stream stdout+stderr to the
    // log file the /status route reads.
    const out = fs.openSync(LOG_PATH, "a");
    const child = spawn("bash", [SCRIPT_PATH], {
      cwd: REPO_DIR,
      env,
      detached: true,
      stdio: ["ignore", out, out],
    });
    if (child.pid) fs.writeFileSync(PID_PATH, String(child.pid));
    child.unref();

    log.info({ pid: child.pid, baseUrl, includeAuth, fresh }, "Copyright capture started");
    return NextResponse.json({ started: true, pid: child.pid, baseUrl, includeAuth, fresh, startedAt });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to start copyright capture");
    return NextResponse.json({ error: "Failed to start capture" }, { status: 500 });
  }
}
