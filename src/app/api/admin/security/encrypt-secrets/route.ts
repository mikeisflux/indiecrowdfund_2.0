import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/vault";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const PLAINTEXT_PREFIXES = ["sk_", "pk_", "whsec_", "SG.", "key-", "sk-ant-", "rk_", "shpat_", "AIza"];

function isPlaintext(value: string): boolean {
  return PLAINTEXT_PREFIXES.some((prefix) => value.startsWith(prefix));
}

// Secret fields stored in PlatformSettings
const SECRET_FIELDS = [
  "stripeSecretKey",
  "stripePublishableKey",
  "stripeWebhookSecret",
  "stripeConnectWebhookSecret",
  "sendgridApiKey",
  "sendgridWebhookVerificationKey",
  "mailgunApiKey",
  "mailgunWebhookSigningKey",
  "anthropicApiKey",
  "googlePlacesApiKey",
  "divinityCoinApiKey",
  "divinityCoinWebhookSecret",
  "divinityCoinStripePublishableKey",
  "smtpPassword",
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
  "shuftiSecretKey",
  "r2AccessKeyId",
  "r2SecretAccessKey",
  "recaptchaSiteKey",
  "recaptchaSecretKey",
] as const;

/**
 * POST /api/admin/security/encrypt-secrets
 * Migrates plaintext secrets in PlatformSettings to encrypted storage.
 * Only SUPER_ADMIN can run this.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await db.platformSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    return NextResponse.json({ error: "No settings found" }, { status: 404 });
  }

  const encrypted: string[] = [];
  const alreadyEncrypted: string[] = [];
  const empty: string[] = [];
  const updateData: Record<string, string> = {};

  for (const field of SECRET_FIELDS) {
    const value = (settings as Record<string, unknown>)[field];
    if (!value || typeof value !== "string") {
      empty.push(field);
      continue;
    }

    if (isPlaintext(value)) {
      updateData[field] = encryptSecret(value);
      encrypted.push(field);
    } else {
      alreadyEncrypted.push(field);
    }
  }

  if (Object.keys(updateData).length > 0) {
    await db.platformSettings.update({
      where: { id: "default" },
      data: updateData,
    });
  }

  logger.info(
    { encrypted, alreadyEncrypted: alreadyEncrypted.length, empty: empty.length },
    "Secret encryption migration completed"
  );

  return NextResponse.json({
    success: true,
    encrypted,
    alreadyEncrypted: alreadyEncrypted.length,
    empty: empty.length,
  });
}
