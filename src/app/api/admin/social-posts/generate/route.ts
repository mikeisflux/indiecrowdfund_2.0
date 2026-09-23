import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateSocialPosts } from "@/lib/social/publicist";
import { verifyTwitterCredentials, getTwitterCredentials } from "@/lib/social/twitter";

const adminSocialGenerateLogger = logger.child({ module: "admin-social-posts-generate" });

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// "Scan Now" — run the publicist's generation phase on demand so the
// admin can see what the AI would post without waiting for the cron.
// Publishing still goes through approval / the cron / Post Now.
export async function POST() {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const startedAt = Date.now();
    const result = await generateSocialPosts();

    // Include a credential check so the admin page can show connection
    // state alongside fresh results.
    const creds = await getTwitterCredentials();
    const connection = creds
      ? await verifyTwitterCredentials(creds)
      : { ok: false as const, error: "X credentials not configured" };

    await db.aiRunLog
      .create({
        data: {
          action: "runSocialPublicist",
          serviceId: "social-publicist",
          success: true,
          message: `Manual scan: queued ${result.queued} post(s), ${result.skippedExisting} already covered`,
          resultJson: { generated: result } as object,
          trigger: "manual",
          triggeredById: session.user.id,
          durationMs: Date.now() - startedAt,
        },
      })
      .catch((e: unknown) =>
        adminSocialGenerateLogger.error({ err: formatError(e) }, "Failed to write AI run log")
      );

    return NextResponse.json({ ...result, connection });
  } catch (error) {
    adminSocialGenerateLogger.error({ err: formatError(error) }, "Manual generation failed");
    return NextResponse.json({ error: "Failed to generate posts" }, { status: 500 });
  }
}
