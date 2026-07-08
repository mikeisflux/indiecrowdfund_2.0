import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { withCorrelation, CORRELATION_HEADER } from "@/lib/correlation";

const authSessionLogger = logger.child({ module: "auth-session" });
import { validateSession } from "@/lib/auth/session";

// This route uses cookies and must be dynamic
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withCorrelation(req, async (correlationId) => {
    try {
      const session = await validateSession();

      if (!session) {
        return NextResponse.json({ user: null }, {
          headers: { [CORRELATION_HEADER]: correlationId },
        });
      }

      return NextResponse.json(session, {
        headers: { [CORRELATION_HEADER]: correlationId },
      });
    } catch (error) {
      authSessionLogger.error({ correlationId, err: formatError(error) }, "Error fetching session:");
      return NextResponse.json({ user: null }, {
        headers: { [CORRELATION_HEADER]: correlationId },
      });
    }
  });
}
