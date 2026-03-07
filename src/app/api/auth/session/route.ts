import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const authSessionLogger = logger.child({ module: "auth-session" });
import { validateSession } from "@/lib/auth/session";

// This route uses cookies and must be dynamic
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await validateSession();

    if (!session) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json(session);
  } catch (error) {
    authSessionLogger.error({ err: String(error) }, "Error fetching session:");
    return NextResponse.json({ user: null });
  }
}
