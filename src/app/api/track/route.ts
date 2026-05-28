import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const trackLogger = logger.child({ module: "track" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { circuitBreaker } from "@/lib/circuit-breaker";
import { trackReferrer } from "@/lib/tracking/index";

// Simple in-memory cache to avoid hitting IP-API rate limits (45 req/min)
const geoCache = new Map<string, { country: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Lookup country from IP using ip-api.com (free, no API key needed)
 */
async function lookupCountryFromIP(ip: string): Promise<string | null> {
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.country;
  }

  try {
    const response = await circuitBreaker.execute("ip-geo", () =>
      fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
        signal: AbortSignal.timeout(2000),
      })
    );

    if (response.ok) {
      const data = await response.json();
      if (data.countryCode) {
        geoCache.set(ip, { country: data.countryCode, timestamp: Date.now() });
        return data.countryCode;
      }
    }
  } catch {
    // Don't let geo lookup failures affect tracking
  }

  return null;
}

// Allow CORS for tracking requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// POST - Log a behavior event
export async function POST(request: Request) {
  try {
    // Guard against empty or malformed request bodies (bots often send empty POSTs)
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid or empty request body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const {
      eventType,
      sessionId,
      projectId,
      categoryId,
      rewardId,
      searchQuery,
      path,
      referrer,
      timeSpent,
      scrollDepth,
      metadata,
    } = body;

    // Validate required fields
    if (!eventType || !sessionId || !path) {
      return NextResponse.json(
        { error: "Missing required fields: eventType, sessionId, path" },
        { status: 400 }
      );
    }

    // Valid event types
    const validEventTypes = [
      "PAGE_VIEW",
      "PAGE_EXIT",
      "PROJECT_VIEW",
      "PROJECT_CLICK",
      "REWARD_CLICK",
      "VIDEO_PLAY",
      "VIDEO_COMPLETE",
      "SEARCH",
      "FILTER_APPLY",
      "PROJECT_SAVE",
      "PROJECT_SHARE",
      "COMMENT_POST",
      "PLEDGE_START",
      "PLEDGE_COMPLETE",
      "SCROLL_DEPTH",
      "HOVER",
      "CREATOR_VIEW",
    ];

    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid event type. Must be one of: ${validEventTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Get user ID if authenticated
    let userId: string | null = null;
    try {
      const session = await auth();
      userId = session?.user?.id || null;
    } catch {
      // Not authenticated, that's fine
    }

    // Get request metadata
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || undefined;
    const forwardedFor = headersList.get("x-forwarded-for");
    const realIp = headersList.get("x-real-ip");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || undefined;

    // Lookup country from IP (skip localhost/private IPs)
    let country: string | null = null;
    if (ipAddress && !ipAddress.startsWith("127.") && !ipAddress.startsWith("192.168.") && !ipAddress.startsWith("10.") && ipAddress !== "::1") {
      country = await lookupCountryFromIP(ipAddress);
    }

    // Create the behavior record
    await db.userBehavior.create({
      data: {
        userId,
        sessionId,
        eventType: eventType as "PAGE_VIEW" | "PAGE_EXIT" | "PROJECT_VIEW" | "PROJECT_CLICK" | "REWARD_CLICK" | "VIDEO_PLAY" | "VIDEO_COMPLETE" | "SEARCH" | "FILTER_APPLY" | "PROJECT_SAVE" | "PROJECT_SHARE" | "COMMENT_POST" | "PLEDGE_START" | "PLEDGE_COMPLETE" | "SCROLL_DEPTH" | "HOVER" | "CREATOR_VIEW",
        projectId: projectId || null,
        categoryId: categoryId || null,
        rewardId: rewardId || null,
        searchQuery: searchQuery || null,
        path,
        referrer: referrer || null,
        userAgent,
        ipAddress,
        country,
        timeSpent: timeSpent ? parseInt(timeSpent) : null,
        scrollDepth: scrollDepth ? parseFloat(scrollDepth) : null,
        metadata: metadata || null,
      },
    });

    // Update the per-day ReferralTracker row on PROJECT_VIEW so the
    // creator dashboard's Traffic Sources panel gets populated. The
    // sibling /api/tracking endpoint was already doing this, but the
    // client-side `tracking.projectView()` helper posts to /api/track,
    // not /api/tracking — so the referralTracker table was never
    // touched and Traffic Sources rendered "No traffic data yet" for
    // every project. Failures here are swallowed inside trackReferrer.
    if (eventType === "PROJECT_VIEW" && projectId) {
      await trackReferrer(projectId, referrer || "");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    trackLogger.error({ err: formatError(error) }, "Error logging behavior:");
    return NextResponse.json(
      { error: "Failed to log behavior" },
      { status: 500 }
    );
  }
}
