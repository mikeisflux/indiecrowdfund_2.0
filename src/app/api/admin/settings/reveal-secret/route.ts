import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/vault";
import { logger } from "@/lib/logger";

const revealLogger = logger.child({ module: "admin-settings-reveal" });

export const dynamic = "force-dynamic";

// Allowlist of PlatformSettings columns that the admin UI may reveal.
// Anything outside this list returns 400 — prevents a typo'd or
// malicious field name from leaking DB columns that were never meant
// to be exposed (user IDs, audit timestamps, etc).
const REVEALABLE_FIELDS = new Set([
  "stripePublishableKey",
  "stripeSecretKey",
  "stripeWebhookSecret",
  "stripeConnectWebhookSecret",
  "divinityCoinApiKey",
  "divinityCoinWebhookSecret",
  "divinityCoinStripePublishableKey",
  "paypalClientId",
  "paypalClientSecret",
  "paypalWebhookId",
  "whopApiKey",
  "whopWebhookSecret",
  "nmiSecurityKey",
  "nmiPublicKey",
  "nmiWebhookSecret",
  "printingComicsApiKey",
  "printingComicsWebhookSecret",
  "smtpPassword",
  "sendgridApiKey",
  "sendgridWebhookVerificationKey",
  "mailgunApiKey",
  "mailgunWebhookSigningKey",
  "googlePlacesApiKey",
  "recaptchaSiteKey",
  "recaptchaSecretKey",
  "facebookAppSecret",
  "facebookPageAccessToken",
  "youtubeClientSecret",
  "youtubeApiKey",
  "twitterApiKey",
  "twitterApiSecret",
  "twitterBearerToken",
  "twitterAccessToken",
  "twitterAccessSecret",
  "stabilityApiKey",
  "anthropicApiKey",
]);

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { field?: string } | null;
    const field = body?.field;
    if (!field || typeof field !== "string") {
      return NextResponse.json({ error: "field is required" }, { status: 400 });
    }
    if (!REVEALABLE_FIELDS.has(field)) {
      return NextResponse.json({ error: "field is not revealable" }, { status: 400 });
    }

    const settings = (await db.platformSettings.findFirst({
      select: { [field]: true } as Record<string, true>,
    })) as Record<string, unknown> | null;

    if (!settings) {
      return NextResponse.json({ value: "" });
    }

    const stored = settings[field];
    if (stored === null || stored === undefined || stored === "") {
      return NextResponse.json({ value: "" });
    }
    if (typeof stored !== "string") {
      return NextResponse.json({ error: "field is not a string secret" }, { status: 400 });
    }

    // Stored values are AES-256-GCM encrypted via encryptSecret(). Try
    // to decrypt; if the value was somehow saved as plaintext (legacy
    // rows), fall back to returning it as-is.
    let value: string;
    try {
      value = decryptSecret(stored);
    } catch {
      value = stored;
    }

    // Audit trail: log every reveal so we can trace who pulled which
    // secret in plaintext. SUPER_ADMIN-only access plus this log gives
    // us a full chain of custody.
    revealLogger.info(
      { actorId: session.user.id, field },
      "Admin revealed PlatformSettings secret"
    );

    return NextResponse.json({ value });
  } catch (err) {
    revealLogger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "reveal-secret error"
    );
    return NextResponse.json({ error: "Failed to reveal secret" }, { status: 500 });
  }
}
