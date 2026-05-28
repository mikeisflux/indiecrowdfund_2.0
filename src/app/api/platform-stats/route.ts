import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getPlatformTotals } from "@/lib/stats";

const platformStatsLogger = logger.child({ module: "platform-stats" });

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const totals = await getPlatformTotals();
    return NextResponse.json(totals);
  } catch (error) {
    platformStatsLogger.error({ err: formatError(error) }, "Error fetching platform stats:");
    return NextResponse.json({ error: "Failed to fetch platform stats" }, { status: 500 });
  }
}
