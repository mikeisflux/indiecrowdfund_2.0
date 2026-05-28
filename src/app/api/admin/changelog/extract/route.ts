import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminChangelogExtractLogger = logger.child({ module: "admin-changelog-extract" });
import { auth } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minute timeout for long-running script

/**
 * POST /api/admin/changelog/extract
 *
 * Run the changelog extraction script from git commits
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = session.user.role;
    if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const forceUpdate = body.force === true;

    // Run the script
    const scriptPath = "scripts/extract-changelog-from-git.ts";
    const command = forceUpdate
      ? `npx tsx ${scriptPath} --force`
      : `npx tsx ${scriptPath}`;

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 280000, // 4.5 minute timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    // Parse the output to get stats
    const output = stdout + stderr;

    // Extract stats from output
    const createdMatch = output.match(/✅ Created (\d+) new changelog entries/);
    const updatedMatch = output.match(/🔄 Updated (\d+) existing entries/);
    const skippedMatch = output.match(/⏭️ Skipped (\d+) \(duplicates or noise\)/);

    return NextResponse.json({
      success: true,
      message: "Changelog extraction completed",
      stats: {
        created: createdMatch ? parseInt(createdMatch[1]) : 0,
        updated: updatedMatch ? parseInt(updatedMatch[1]) : 0,
        skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
      },
      output: output.slice(-2000), // Last 2000 chars of output
    });
  } catch (error) {
    adminChangelogExtractLogger.error({ err: formatError(error) }, "Error running changelog extraction:");

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorOutput = (error as { stdout?: string; stderr?: string })?.stdout ||
                       (error as { stdout?: string; stderr?: string })?.stderr || "";

    return NextResponse.json(
      {
        error: "Script execution failed",
        details: errorMessage,
        output: errorOutput.slice(-2000),
      },
      { status: 500 }
    );
  }
}
