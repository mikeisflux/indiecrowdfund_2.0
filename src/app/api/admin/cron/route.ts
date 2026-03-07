import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminCronLogger = logger.child({ module: "admin-cron" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Super Admin access required", status: 403 };
  }
  return { user: session.user };
}

// GET - Read current crontab
export async function GET() {
  try {
    const authResult = await requireSuperAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    try {
      const { stdout } = await execAsync("crontab -l 2>/dev/null");
      return NextResponse.json({ crontab: stdout });
    } catch {
      // crontab -l returns exit code 1 when no crontab exists
      return NextResponse.json({ crontab: "" });
    }
  } catch (error) {
    adminCronLogger.error({ err: String(error) }, "Error reading crontab:");
    return NextResponse.json(
      { error: "Failed to read crontab" },
      { status: 500 }
    );
  }
}

// PUT - Write full crontab
export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireSuperAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { crontab } = await req.json();

    if (typeof crontab !== "string") {
      return NextResponse.json(
        { error: "crontab must be a string" },
        { status: 400 }
      );
    }

    // Backup current crontab before overwriting
    let backup = "";
    try {
      const { stdout } = await execAsync("crontab -l 2>/dev/null");
      backup = stdout;
    } catch {
      // No existing crontab
    }

    // Write new crontab via stdin pipe
    const content = crontab.endsWith("\n") ? crontab : crontab + "\n";

    try {
      await execAsync(`echo ${JSON.stringify(content)} | crontab -`);
    } catch (error) {
      adminCronLogger.error({ err: String(error) }, "Error writing crontab:");
      // Try to restore backup if write failed
      if (backup) {
        try {
          await execAsync(`echo ${JSON.stringify(backup)} | crontab -`);
        } catch {
          // Restoration failed too
        }
      }
      return NextResponse.json(
        { error: "Failed to write crontab. Invalid syntax?" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, backup });
  } catch (error) {
    adminCronLogger.error({ err: String(error) }, "Error writing crontab:");
    return NextResponse.json(
      { error: "Failed to write crontab" },
      { status: 500 }
    );
  }
}
