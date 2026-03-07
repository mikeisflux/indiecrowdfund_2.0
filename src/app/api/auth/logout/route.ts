import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const authLogoutLogger = logger.child({ module: "auth-logout" });
import { deleteSession } from "@/lib/auth/session";

export async function POST() {
  try {
    await deleteSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    authLogoutLogger.error({ err: String(error) }, "Logout error:");
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
