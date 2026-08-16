import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { TERMS_VERSION } from "@/components/legal/terms-of-service";

const termsAcceptanceLogger = logger.child({ module: "legal-terms-acceptance" });

/**
 * POST /api/legal/terms-acceptance
 *
 * Records that the signed-in user accepted the current Terms.
 *
 * The version is taken from the server constant, never from the request body:
 * a client that could name its own version could claim to have accepted a
 * future one and skip the prompt forever.
 *
 * Not in csrfExemptRoutes, so callers must go through apiFetch.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 1000) || null;

    // Upsert on the composite key so a double-submit or a second tab records
    // one acceptance rather than failing on the unique index.
    await db.termsAcceptance.upsert({
      where: {
        userId_version: { userId: session.user.id, version: TERMS_VERSION },
      },
      create: {
        userId: session.user.id,
        version: TERMS_VERSION,
        ipAddress,
        userAgent,
      },
      // The first acceptance is the one that counts, so nothing is overwritten.
      update: {},
    });

    termsAcceptanceLogger.info(
      { userId: session.user.id, version: TERMS_VERSION },
      "Terms accepted"
    );

    return NextResponse.json({ success: true, version: TERMS_VERSION });
  } catch (error) {
    termsAcceptanceLogger.error(
      { err: formatError(error) },
      "Failed to record terms acceptance"
    );
    return NextResponse.json(
      { error: "Failed to record acceptance" },
      { status: 500 }
    );
  }
}
