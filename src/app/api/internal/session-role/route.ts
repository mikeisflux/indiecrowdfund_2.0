import { NextRequest, NextResponse } from "next/server";
import { validateSessionToken } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";

const sessionRoleLogger = logger.child({ module: "internal-session-role" });

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/session-role
 *
 * Tells the proxy whether a session token belongs to an admin, so admins can
 * keep using the site while maintenance mode is on.
 *
 * Sessions are database-backed, so middleware cannot validate one itself —
 * hence the round trip, the same shape as /api/internal/blocked-ips. Only
 * called while maintenance is actually enabled, so it costs nothing in normal
 * operation.
 *
 * Returns a role and nothing else. No name, no email, no session contents.
 */
export async function POST(req: NextRequest) {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret && req.headers.get("x-internal-secret") !== internalSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { token } = await req.json();
    if (typeof token !== "string" || !token) {
      return NextResponse.json({ role: null });
    }

    const session = await validateSessionToken(token);
    return NextResponse.json({ role: session?.role ?? null });
  } catch (error) {
    sessionRoleLogger.error({ err: formatError(error) }, "Failed to resolve session role");
    // Treated as "not an admin" by the caller, which fails safe: the worst
    // outcome is an admin seeing the maintenance page they themselves enabled.
    return NextResponse.json({ role: null });
  }
}
