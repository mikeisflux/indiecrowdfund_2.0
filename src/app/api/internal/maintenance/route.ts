/**
 * Internal API for maintenance mode.
 *
 * Called by the proxy so the /admin toggle actually takes the site down.
 * Middleware cannot open a Prisma connection, which is why the flag lived in
 * an env var and the database column sat unread — the switch in the admin UI
 * wrote a value nothing consulted.
 *
 * SECURITY: same posture as /api/internal/blocked-ips — shared secret, and
 * never exposed through nginx. It returns no secrets either way: whether the
 * site is down for maintenance is visible to anyone who loads the homepage.
 */

import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";

const internalMaintenanceLogger = logger.child({ module: "internal-maintenance" });

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret && req.headers.get("x-internal-secret") !== internalSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const settings = await db.platformSettings.findFirst({
      select: {
        maintenanceMode: true,
        maintenanceStartsAt: true,
        maintenanceEndsAt: true,
        maintenanceMessage: true,
      },
    });

    if (!settings) {
      return NextResponse.json({ enabled: false });
    }

    const now = Date.now();
    const startsAt = settings.maintenanceStartsAt?.getTime();
    const endsAt = settings.maintenanceEndsAt?.getTime();

    // A window governs when the toggle applies. Without one the toggle is an
    // immediate, open-ended outage. With one, the site takes itself down and
    // brings itself back without anyone needing to be awake for either edge.
    let enabled = settings.maintenanceMode;
    if (enabled) {
      if (startsAt && now < startsAt) enabled = false;
      if (endsAt && now >= endsAt) enabled = false;
    }

    return NextResponse.json({
      enabled,
      message: settings.maintenanceMessage || null,
      startsAt: settings.maintenanceStartsAt?.toISOString() || null,
      endsAt: settings.maintenanceEndsAt?.toISOString() || null,
    });
  } catch (error) {
    internalMaintenanceLogger.error(
      { err: formatError(error) },
      "Failed to read maintenance settings"
    );
    // Fail OPEN. A database blip must not take the whole site down; the
    // opposite failure — staying up a few seconds too long — is recoverable.
    return NextResponse.json({ enabled: false });
  }
}
