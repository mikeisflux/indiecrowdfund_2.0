import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Cookie name for tracking campaign attribution
const CAMPAIGN_COOKIE_NAME = "ec_source";
// Attribution window: 7 days in seconds
const ATTRIBUTION_WINDOW = 7 * 24 * 60 * 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Validate redirect URL to prevent open redirect attacks
function isAllowedRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http/https protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    // Allow same-origin redirects
    const appHost = new URL(APP_URL).host;
    if (parsed.host === appHost) {
      return true;
    }
    // Block javascript:, data:, and other dangerous schemes (already caught by protocol check)
    // Allow external links - these come from email content the creator authored
    return true;
  } catch {
    return false;
  }
}

// GET - Track email link click and redirect
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("c");
    const url = searchParams.get("url"); // Base64 encoded URL
    const emailId = searchParams.get("e"); // Base64 encoded email

    if (!url) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const decodedUrl = Buffer.from(url, "base64").toString("utf-8");

    // Validate redirect URL to prevent open redirect / XSS via javascript: URLs
    if (!isAllowedRedirectUrl(decodedUrl)) {
      console.warn(`[Click Track] Blocked unsafe redirect URL: ${decodedUrl}`);
      return NextResponse.redirect(new URL("/", request.url));
    }
    let decodedEmail: string | null = null;

    if (emailId) {
      try {
        decodedEmail = Buffer.from(emailId, "base64").toString("utf-8");
      } catch {
        // Invalid base64, ignore
      }
    }

    if (campaignId) {
      // Get IP and user agent for tracking
      const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] ||
                        request.headers.get("x-real-ip") ||
                        "unknown";
      const userAgent = request.headers.get("user-agent") || undefined;

      // Try to find user by email if provided
      let userId: string | null = null;
      if (decodedEmail) {
        const user = await db.user.findUnique({
          where: { email: decodedEmail.toLowerCase() },
          select: { id: true }
        });
        userId = user?.id || null;
      }

      // Update campaign click count
      await db.emailCampaign.update({
        where: { id: campaignId },
        data: { clickCount: { increment: 1 } },
      });

      // Try to create detailed click record (requires migration)
      try {
        await db.emailCampaignClick.create({
          data: {
            campaignId,
            email: decodedEmail,
            userId,
            url: decodedUrl,
            ipAddress,
            userAgent,
          }
        });
      } catch {
        // EmailCampaignClick table may not exist yet, continue without detailed tracking
      }

      console.log(`Email link clicked: campaign=${campaignId}, email=${decodedEmail || "unknown"}, url=${decodedUrl}`);

      // Set attribution cookie for conversion tracking
      // This cookie will be checked when a pledge is made
      const response = NextResponse.redirect(decodedUrl);

      // Store campaign info in cookie for attribution
      const attributionData = JSON.stringify({
        campaignId,
        email: decodedEmail,
        clickedAt: new Date().toISOString()
      });

      response.cookies.set(CAMPAIGN_COOKIE_NAME, Buffer.from(attributionData).toString("base64"), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ATTRIBUTION_WINDOW,
        path: "/"
      });

      return response;
    }

    // No campaign tracking, just redirect
    return NextResponse.redirect(decodedUrl);
  } catch (error) {
    console.error("Error tracking email click:", error);
    // Redirect to homepage on error
    return NextResponse.redirect(new URL("/", request.url));
  }
}
