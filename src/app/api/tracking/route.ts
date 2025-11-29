import { NextRequest, NextResponse } from "next/server";
import { trackEvent, trackProjectView, trackReferrer } from "@/lib/tracking/index";

/**
 * Get geolocation data from request headers
 * Works with Vercel's built-in geo headers, Cloudflare headers, or falls back to null
 */
function getGeoData(req: NextRequest): { country: string | null; city: string | null; ip: string | null } {
  // Vercel's built-in geolocation (free on Vercel)
  const vercelCountry = req.headers.get("x-vercel-ip-country");
  const vercelCity = req.headers.get("x-vercel-ip-city");

  // Cloudflare headers (if using Cloudflare)
  const cfCountry = req.headers.get("cf-ipcountry");
  const cfCity = req.headers.get("cf-ipcity");

  // Get IP address from various headers
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || req.headers.get("cf-connecting-ip")
    || null;

  return {
    country: vercelCountry || cfCountry || null,
    city: vercelCity || cfCity || null,
    ip,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
    const geo = getGeoData(req);

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
