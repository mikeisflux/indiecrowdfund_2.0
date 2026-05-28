/**
 * Internal API for bot blocker persistence
 * Called by middleware to persist/retrieve blocked IPs
 *
 * SECURITY: This endpoint is restricted to localhost only
 */

import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const internalBlockedIpsLogger = logger.child({ module: "internal-blocked-ips" });
import { db } from "@/lib/db";
import { appendFile } from "fs/promises";

export const dynamic = "force-dynamic";

// Check if request is from localhost (middleware runs on same server)
function isLocalhost(req: NextRequest): boolean {
  // Check for internal API secret first (most secure method)
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret) {
    const authHeader = req.headers.get("x-internal-secret");
    if (authHeader === internalSecret) {
      return true;
    }
  }

  // Same-origin / same-host detection: the middleware's persistBlockedIP()
  // opens a Node fetch to http://127.0.0.1:${PORT}/api/internal/blocked-ips.
  // Depending on how the server is wrapped (direct Next.js, nginx loopback,
  // PM2, etc.) the request can arrive with:
  //   - Host: 127.0.0.1:3000  (direct fetch to Next.js)
  //   - Host: localhost:3000
  //   - Host: indiecrowdfund.com  (if the proxy rewrites Host)
  //   - x-forwarded-for = 127.0.0.1 (if there's a proxy that sets it)
  //
  // We accept ANY of these combinations as localhost, since this endpoint
  // is never exposed via nginx to the outside world (it's on the internal
  // port only) and any external request that actually reaches here has
  // already proven it can bind to the internal interface.
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const clientIp = forwarded?.split(",")[0]?.trim() || realIp || "";

  if (
    clientIp === "127.0.0.1" ||
    clientIp === "::1" ||
    clientIp === "localhost" ||
    clientIp === "::ffff:127.0.0.1"
  ) {
    return true;
  }

  // No proxy headers = direct fetch from a process on the same host
  // (can't be an external request because nginx/Caddy would add them).
  if (!forwarded && !realIp) {
    const host = (req.headers.get("host") || "").toLowerCase();
    if (
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("[::1]") ||
      host.startsWith("::1")
    ) {
      return true;
    }
  }

  return false;
}

// GET - Retrieve all currently blocked IPs
export async function GET(req: NextRequest) {
  // Restrict to localhost only
  if (!isLocalhost(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const now = new Date();
    const blockedIPs = await db.blockedIP.findMany({
      where: { expiresAt: { gt: now } },
      select: { ipAddress: true, expiresAt: true },
    });

    return NextResponse.json({
      blocked: blockedIPs.map((ip: { ipAddress: string; expiresAt: Date }) => ({
        ip: ip.ipAddress,
        expiresAt: ip.expiresAt.getTime(),
      })),
    });
  } catch (error) {
    internalBlockedIpsLogger.error({ err: formatError(error) }, "[Bot Blocker API] Error fetching blocked IPs:");
    return NextResponse.json({ blocked: [] });
  }
}

// POST - Record suspicious activity and potentially block IP
export async function POST(req: NextRequest) {
  // Restrict to localhost only
  if (!isLocalhost(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { ip, reason, actionId, path, userAgent, block } = body;

    if (!ip) {
      return NextResponse.json({ error: "IP required" }, { status: 400 });
    }

    // Log suspicious activity
    await db.suspiciousActivity.create({
      data: {
        ipAddress: ip,
        reason: reason || "Unknown",
        actionId,
        path,
        userAgent,
      },
    });

    // If block flag is set, add to blocked IPs
    if (block) {
      // Scale block duration based on repeat offenses:
      //   1st block = 24h
      //   2nd      = 3 days
      //   3rd      = 7 days
      //   4th      = 30 days
      //   5th+     = PERMANENT
      // By violation #5 this IP has repeatedly come back after 30 days
      // in the penalty box — it's a confirmed attacker (scraper, scanner,
      // rate-limit abuser). Stop catch-and-releasing. Sentinel 504/400
      // fallout already spikes when these IPs come back, so keeping them
      // gone saves real worker capacity for legit traffic.
      // Uses year 9999 as a "never expires" sentinel; the existing
      // isIPBlocked cleanup skips rows whose expiresAt is in the future
      // (which this always is) without any schema change.
      const PERMANENT_EXPIRES_AT = new Date("9999-12-31T00:00:00.000Z");
      const existing = await db.blockedIP.findUnique({
        where: { ipAddress: ip },
        select: { violationCount: true },
      });
      const violations = (existing?.violationCount || 0) + 1;
      const isPermanent = violations >= 5;
      const durationHours = violations <= 1 ? 24 : violations === 2 ? 72 : violations === 3 ? 168 : 720;
      const expiresAt = isPermanent
        ? PERMANENT_EXPIRES_AT
        : new Date(Date.now() + durationHours * 60 * 60 * 1000);

      await db.blockedIP.upsert({
        where: { ipAddress: ip },
        create: {
          ipAddress: ip,
          reason: reason || "Bot detected",
          expiresAt,
          lastUserAgent: userAgent,
          lastPath: path,
          lastActionId: actionId,
        },
        update: {
          reason: reason || "Bot detected",
          expiresAt,
          violationCount: { increment: 1 },
          lastUserAgent: userAgent,
          lastPath: path,
          lastActionId: actionId,
        },
      });

      // Write to pending file for immediate firewall application
      try {
        await appendFile("/tmp/botblock-pending", `${ip}\n`);
      } catch {
        // Non-fatal
      }

      internalBlockedIpsLogger.info(`[Bot Blocker API] IP blocked: ${ip} - ${reason} (${isPermanent ? "PERMANENT" : durationHours + "h"}, violation #${violations})`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    internalBlockedIpsLogger.error({ err: formatError(error) }, "[Bot Blocker API] Error:");
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
