import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const whopConfigRouteLogger = logger.child({ module: "whop-config-route" });

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { whopEnabled: true, whopPlanId: true, whopEnvironment: true },
    });

    if (!settings?.whopEnabled) {
      return NextResponse.json({ error: "Whop not enabled" }, { status: 404 });
    }

    const planId = settings.whopPlanId || process.env.WHOP_PLAN_ID || "";
    const environment = settings.whopEnvironment || process.env.WHOP_ENVIRONMENT || "production";

    if (!planId) {
      whopConfigRouteLogger.error("Whop plan ID not configured");
      return NextResponse.json({ error: "Whop not configured" }, { status: 500 });
    }

    return NextResponse.json({ planId, environment });
  } catch (error) {
    whopConfigRouteLogger.error({ err: String(error) }, "Failed to fetch Whop config");
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}
