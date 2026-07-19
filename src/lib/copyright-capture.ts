import path from "path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Resolve the repo root the same way the build-backup admin routes do, so the
// capture script and its output land in the right place regardless of how the
// server process was started.
export function getRepoDir(): string {
  if (process.env.APP_ROOT) return process.env.APP_ROOT;
  const cwd = process.cwd();
  if (cwd.includes("indiecrowdfund")) return cwd;
  return "/root/indiecrowdfund_2.0";
}

export const REPO_DIR = getRepoDir();
export const SCRIPT_PATH = path.join(REPO_DIR, "scripts", "make-copyright-pdf.sh");
export const OUT_DIR = path.join(REPO_DIR, "copyrightpdf");
export const PDF_FILENAME = "indiecrowdfund-all-pages.pdf";
export const PDF_PATH = path.join(OUT_DIR, PDF_FILENAME);
export const RUN_DIR = path.join(OUT_DIR, ".run");
export const LOG_PATH = path.join(RUN_DIR, "capture.log");
export const PID_PATH = path.join(RUN_DIR, "capture.pid");

type Gate =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

// Copyright capture runs a shell script on the server and screenshots the
// admin's own logged-in pages, so it is restricted to SUPER_ADMIN.
export async function requireSuperAdmin(): Promise<Gate> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, status: 401, error: "Unauthorized" };

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") {
    return { ok: false, status: 403, error: "Forbidden - Super Admin access required" };
  }
  return { ok: true, userId: session.user.id };
}

// A signal-0 kill throws ESRCH if the pid is gone, so this is a cheap
// "is the capture still running?" check.
export function isPidAlive(pid: number | null): boolean {
  if (!pid || Number.isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
