import { NextRequest, NextResponse } from "next/server";
import { trackEvent, trackProjectView, trackReferrer } from "@/lib/tracking/index";

// Simple in-memory cache to avoid hitting IP-API rate limits (45 req/min)
const geoCache = new Map<string, { country: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Lookup country from IP using ip-api.com (free, no API key needed)
 */
async function lookupCountryFromIP(ip: string): Promise<string | null> {
  // Check cache first
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.country;
  }

  try {
    // ip-api.com is free, no API key needed
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      if (data.countryCode) {
        // Cache the result
        geoCache.set(ip, { country: data.countryCode, timestamp: Date.now() });
        return data.countryCode;
      }
    }
  } catch {
    // Don't let geo lookup failures affect tracking
  }

  return null;
}

/**
 * Get geolocation data from IP address
 */
async function getGeoData(req: NextRequest): Promise<{ country: string | null; ip: string | null }> {
  // Get IP address from headers
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || null;

  let country: string | null = null;

  // Lookup country from IP (skip localhost/private IPs)
  if (ip && !ip.startsWith("127.") && !ip.startsWith("192.168.") && !ip.startsWith("10.") && ip !== "::1") {
    country = await lookupCountryFromIP(ip);
  }

  return { country, ip };
}

export async function POST(req: NextRequest) {
  try {
    // Guard against empty or malformed request bodies
    let body;
    try {
      body = await req.json();
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
      userId,
      sessionId,
      projectId,
      rewardId,
      metadata,
      referrer,
      page,
    } = body;

    // Validate required fields
    if (!eventType || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get geolocation data from request
    const geo = await getGeoData(req);

    // Handle different event types
    switch (eventType) {
      case "PROJECT_VIEW":
        if (projectId) {
          await trackProjectView(projectId, userId, sessionId, referrer, geo.country, geo.ip);
          if (referrer) {
            await trackReferrer(projectId, referrer);
          }
        }
        break;

      default:
        await trackEvent({
          eventType,
          userId,
          sessionId,
          projectId,
          rewardId,
          metadata,
          referrer,
          page,
          country: geo.country,
          ipAddress: geo.ip,
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tracking error:", error);
    // Return success anyway - tracking shouldn't fail requests
    return NextResponse.json({ success: true });
  }
}
