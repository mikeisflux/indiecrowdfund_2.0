import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const authRecaptchaLogger = logger.child({ module: "auth-recaptcha" });
import { db } from "@/lib/db";

// Force dynamic - reads from database
export const dynamic = "force-dynamic";

/**
 * Public endpoint to get reCAPTCHA site key for frontend
 * This allows the frontend to dynamically load the site key from the database
 */
export async function GET() {
  try {
    // Get settings from database
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        recaptchaEnabled: true,
        recaptchaSiteKey: true,
      },
    });

    // If database has reCAPTCHA enabled with a site key, use it
    if (settings?.recaptchaEnabled && settings?.recaptchaSiteKey) {
      return NextResponse.json({
        enabled: true,
        siteKey: settings.recaptchaSiteKey,
      });
    }

    // Fall back to environment variable
    const envSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (envSiteKey) {
      return NextResponse.json({
        enabled: true,
        siteKey: envSiteKey,
      });
    }

    // reCAPTCHA not configured
    return NextResponse.json({
      enabled: false,
      siteKey: null,
    });
  } catch (error) {
    authRecaptchaLogger.error({ err: String(error) }, "[reCAPTCHA API] Error fetching settings:");

    // Fall back to env var on error
    const envSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    return NextResponse.json({
      enabled: !!envSiteKey,
      siteKey: envSiteKey || null,
    });
  }
}
