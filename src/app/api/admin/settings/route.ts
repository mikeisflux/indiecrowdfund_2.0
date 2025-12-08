import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// GET - Get platform settings
export async function GET() {
  try {
    // Check auth first
    let authResult;
    try {
      authResult = await requireAdmin();
    } catch (authError) {
      console.error("Auth error in settings:", authError);
      return NextResponse.json(
        { error: "Authentication failed", details: String(authError) },
        { status: 500 }
      );
    }

    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Get or create default settings
    let settings;
    try {
      settings = await db.platformSettings.findUnique({
        where: { id: "default" }
      });
    } catch (dbError) {
      console.error("Database error fetching settings:", dbError);
      return NextResponse.json(
        { error: "Database error fetching settings", details: String(dbError) },
        { status: 500 }
      );
    }

    if (!settings) {
      try {
        // Create default settings if they don't exist
        settings = await db.platformSettings.create({
          data: { id: "default" }
        });
      } catch (createError) {
        console.error("Error creating default settings:", createError);
        return NextResponse.json(
          { error: "Failed to create default settings", details: String(createError) },
          { status: 500 }
        );
      }
    }

    // Mask sensitive fields for security (but indicate they exist)
    const maskedSettings = {
      ...settings,
      stripePublishableKey: settings.stripePublishableKey ? "••••••••" : null,
      stripeSecretKey: settings.stripeSecretKey ? "••••••••" : null,
      stripeWebhookSecret: settings.stripeWebhookSecret ? "••••••••" : null,
      ccbillSalt: settings.ccbillSalt ? "••••••••" : null,
      smtpPassword: settings.smtpPassword ? "••••••••" : null,
      sendgridApiKey: settings.sendgridApiKey ? "••••••••" : null,
      mailgunApiKey: settings.mailgunApiKey ? "••••••••" : null,
      openaiApiKey: settings.openaiApiKey ? "••••••••" : null,
      anthropicApiKey: settings.anthropicApiKey ? "••••••••" : null,
      googlePlacesApiKey: settings.googlePlacesApiKey ? "••••••••" : null,
      facebookAppSecret: settings.facebookAppSecret ? "••••••••" : null,
      facebookPageAccessToken: settings.facebookPageAccessToken ? "••••••••" : null,
      youtubeClientSecret: settings.youtubeClientSecret ? "••••••••" : null,
      youtubeApiKey: settings.youtubeApiKey ? "••••••••" : null,
      twitterApiKey: settings.twitterApiKey ? "••••••••" : null,
      twitterApiSecret: settings.twitterApiSecret ? "••••••••" : null,
      twitterBearerToken: settings.twitterBearerToken ? "••••••••" : null,
      twitterAccessToken: settings.twitterAccessToken ? "••••••••" : null,
      twitterAccessSecret: settings.twitterAccessSecret ? "••••••••" : null,
      dalleApiKey: settings.dalleApiKey ? "••••••••" : null,
      stabilityApiKey: settings.stabilityApiKey ? "••••••••" : null,
      shuftiSecretKey: settings.shuftiSecretKey ? "••••••••" : null,
    };

    return NextResponse.json({ settings: maskedSettings });
  } catch (error) {
    console.error("Unexpected error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings", details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH - Update platform settings
export async function PATCH(req: NextRequest) {
  try {
    // Check auth
    let authResult;
    try {
      authResult = await requireAdmin();
    } catch (authError) {
      console.error("Auth error in PATCH settings:", authError);
      return NextResponse.json(
        { error: "Authentication failed", details: String(authError) },
        { status: 500 }
      );
    }

    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON body", details: String(parseError) },
        { status: 400 }
      );
    }

    const { section, data } = body;

    console.log("=== SETTINGS SAVE DEBUG ===");
    console.log("Section:", section);
    console.log("Raw data received:", JSON.stringify(data, null, 2));

    if (!section || !data) {
      return NextResponse.json(
        { error: "Section and data are required" },
        { status: 400 }
      );
    }

    // Filter out masked values and empty strings for secret fields (don't update if user hasn't changed them)
    const secretFields = [
      'stripePublishableKey', 'stripeSecretKey', 'stripeWebhookSecret',
      'ccbillSalt', 'smtpPassword', 'sendgridApiKey', 'mailgunApiKey',
      'openaiApiKey', 'anthropicApiKey', 'googlePlacesApiKey',
      'facebookAppSecret', 'facebookPageAccessToken',
      'youtubeClientSecret', 'youtubeApiKey',
      'twitterApiKey', 'twitterApiSecret', 'twitterBearerToken',
      'twitterAccessToken', 'twitterAccessSecret',
      'dalleApiKey', 'stabilityApiKey', 'shuftiSecretKey'
    ];

    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([key, value]) => {
        // Always filter out masked placeholder values
        if (value === "••••••••") return false;
        // For secret fields, also filter out empty strings (don't overwrite existing with empty)
        if (secretFields.includes(key) && (value === "" || value === null)) return false;
        return true;
      })
    );

    console.log("After filtering masked/empty:", JSON.stringify(filteredData, null, 2));

    // Validate based on section
    const allowedFields: Record<string, string[]> = {
      general: [
        "siteName", "siteDescription", "supportEmail", "timezone",
        "currency", "platformFee", "maintenanceMode", "googlePlacesApiKey",
        "logoUrl", "faviconUrl"
      ],
      payments: [
        "stripeEnabled", "stripePublishableKey", "stripeSecretKey", "stripeWebhookSecret",
        "ccbillEnabled", "ccbillClientAccountNo", "ccbillSubaccount", "ccbillFormName", "ccbillSalt"
      ],
      email: [
        "emailProvider", "smtpHost", "smtpPort", "smtpUser", "smtpPassword",
        "smtpFromEmail", "smtpFromName", "sendgridApiKey", "mailgunApiKey", "mailgunDomain"
      ],
      social: [
        "twitterHandle", "facebookUrl", "instagramHandle", "youtubeUrl", "discordUrl",
        "facebookAppId", "facebookAppSecret", "facebookPageAccessToken",
        "youtubeClientId", "youtubeClientSecret", "youtubeApiKey",
        "twitterApiKey", "twitterApiSecret", "twitterBearerToken", "twitterAccessToken", "twitterAccessSecret",
        "dalleApiKey", "stabilityApiKey"
      ],
      ai: [
        "aiProvider", "openaiApiKey", "anthropicApiKey",
        "aiAutoModeration", "aiAutoTagging", "aiContentGeneration"
      ],
      aiMarketing: [
        "aiAutoTagging", "aiAutoTagConfidence", "aiMaxTags",
        "aiEmailPersonalization", "aiBehaviorTracking", "aiPredictiveAnalytics",
        "aiSmartSegmentation", "aiAutoOptimization", "aiSendTimeOptimization",
        "aiContentOptimization", "aiAbTesting", "aiEmailFrequencyCap",
        "aiDailyEmailLimit", "aiQuietHoursStart", "aiQuietHoursEnd",
        "aiTrackPageViews", "aiTrackScrollDepth", "aiTrackTimeOnPage",
        "aiTrackClicks", "aiTrackHovers", "aiTrackFormInteractions",
        "aiTrackVideoEngagement", "aiTrackRewardComparisons", "aiTrackAbandonedCarts",
        "aiSessionRecording", "aiHeatmaps", "aiFunnelAnalysis", "aiRetentionDays",
        "aiCronSchedules"
      ],
      security: [
        "twoFactorRequired", "sessionTimeout", "maxLoginAttempts",
        "passwordMinLength", "requireSpecialChars",
        "ipRateLimitEnabled", "ipRateLimitRequests", "ipRateLimitWindow"
      ],
      idverify: [
        "idVerificationEnabled", "shuftiClientId", "shuftiSecretKey",
        "shuftiCallbackUrl", "shuftiRedirectUrl", "idVerificationMinAge", "idVerificationMode"
      ],
      theme: [
        "primaryColor", "secondaryColor", "accentColor",
        "backgroundColor", "textColor", "fontFamily", "borderRadius"
      ]
    };

    const allowed = allowedFields[section];
    if (!allowed) {
      return NextResponse.json(
        { error: "Invalid section" },
        { status: 400 }
      );
    }

    // Only include allowed fields
    const updateData = Object.fromEntries(
      Object.entries(filteredData).filter(([key]) => allowed.includes(key))
    );

    console.log("Final updateData for DB:", JSON.stringify(updateData, null, 2));

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Ensure settings record exists
    const existing = await db.platformSettings.findUnique({
      where: { id: "default" }
    });

    if (!existing) {
      await db.platformSettings.create({
        data: { id: "default" }
      });
    }

    // Update settings
    const settings = await db.platformSettings.update({
      where: { id: "default" },
      data: updateData
    });

    // Mask sensitive fields in response
    const maskedSettings = {
      ...settings,
      stripePublishableKey: settings.stripePublishableKey ? "••••••••" : null,
      stripeSecretKey: settings.stripeSecretKey ? "••••••••" : null,
      stripeWebhookSecret: settings.stripeWebhookSecret ? "••••••••" : null,
      ccbillSalt: settings.ccbillSalt ? "••••••••" : null,
      smtpPassword: settings.smtpPassword ? "••••••••" : null,
      sendgridApiKey: settings.sendgridApiKey ? "••••••••" : null,
      mailgunApiKey: settings.mailgunApiKey ? "••••••••" : null,
      openaiApiKey: settings.openaiApiKey ? "••••••••" : null,
      anthropicApiKey: settings.anthropicApiKey ? "••••••••" : null,
      googlePlacesApiKey: settings.googlePlacesApiKey ? "••••••••" : null,
      facebookAppSecret: settings.facebookAppSecret ? "••••••••" : null,
      facebookPageAccessToken: settings.facebookPageAccessToken ? "••••••••" : null,
      youtubeClientSecret: settings.youtubeClientSecret ? "••••••••" : null,
      youtubeApiKey: settings.youtubeApiKey ? "••••••••" : null,
      twitterApiKey: settings.twitterApiKey ? "••••••••" : null,
      twitterApiSecret: settings.twitterApiSecret ? "••••••••" : null,
      twitterBearerToken: settings.twitterBearerToken ? "••••••••" : null,
      twitterAccessToken: settings.twitterAccessToken ? "••••••••" : null,
      twitterAccessSecret: settings.twitterAccessSecret ? "••••••••" : null,
      dalleApiKey: settings.dalleApiKey ? "••••••••" : null,
      stabilityApiKey: settings.stabilityApiKey ? "••••••••" : null,
      shuftiSecretKey: settings.shuftiSecretKey ? "••••••••" : null,
    };

    return NextResponse.json({
      success: true,
      settings: maskedSettings
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings", details: String(error) },
      { status: 500 }
    );
  }
}
