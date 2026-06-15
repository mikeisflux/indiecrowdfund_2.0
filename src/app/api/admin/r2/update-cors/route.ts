import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { getR2Storage } from "@/lib/r2";

const updateCorsLogger = logger.child({ module: "admin-r2-update-cors" });

// POST /api/admin/r2/update-cors
// Push the CORS ruleset the browser uploads need: allow the public
// app origin on PUT/POST/etc., allow `Content-Type` request header,
// and EXPOSE `ETag` so multipart-upload clients can read each part's
// ETag from JS and feed it into CompleteMultipartUpload. Without
// ExposeHeaders the browser hides ETag from the response object and
// the finalize call has no data to send -> multipart silently breaks.
// Idempotent; safe to re-run.
export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const appOrigin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "https://indiecrowdfund.com";

    await r2.applyDefaultCors([appOrigin]);

    updateCorsLogger.info({ appOrigin }, "R2 CORS updated");
    return NextResponse.json({ success: true, allowedOrigins: [appOrigin] });
  } catch (error) {
    updateCorsLogger.error({ err: formatError(error) }, "Failed to update R2 CORS");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update CORS" },
      { status: 500 }
    );
  }
}
