import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const retailersLogoutLogger = logger.child({ module: "retailers-logout" });
import { cookies } from "next/headers";

// POST - Retailer logout
export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("retailer_token");

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    retailersLogoutLogger.error({ err: formatError(error) }, "Error logging out retailer:");
    return NextResponse.json(
      { error: "Failed to logout" },
      { status: 500 }
    );
  }
}
