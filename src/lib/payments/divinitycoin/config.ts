import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { decryptSecret } from "@/lib/vault";
import type { DivinityCoinConfig } from "./types";

export const paymentsDivinitycoinLogger = logger.child({ module: "payments-divinitycoin" });

export let cachedConfig: DivinityCoinConfig | null = null;

/**
 * Get DivinityCoin configuration from database or environment
 */
export async function getDivinityCoinConfig(): Promise<DivinityCoinConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        divinityCoinApiKey: true,
        divinityCoinPartnerId: true,
        divinityCoinWebhookSecret: true,
        divinityCoinEnabled: true,
      },
    });

    if (settings?.divinityCoinEnabled && settings.divinityCoinApiKey) {
      // Decrypt API key if it was stored encrypted
      let apiKey = settings.divinityCoinApiKey;
      try { apiKey = decryptSecret(apiKey); } catch { /* stored as plaintext */ }
      cachedConfig = {
        apiKey,
        partnerId: settings.divinityCoinPartnerId || "",
        webhookSecret: settings.divinityCoinWebhookSecret || "",
        baseUrl: process.env.DIVINITYCOIN_API_URL || "https://divinitycoin.com/internal",
      };
      return cachedConfig;
    }
  } catch (error) {
    paymentsDivinitycoinLogger.warn({ data: error }, "Could not fetch DivinityCoin settings from database:");
  }

  // Fall back to environment variables
  if (process.env.DIVINITYCOIN_API_KEY) {
    cachedConfig = {
      apiKey: process.env.DIVINITYCOIN_API_KEY,
      partnerId: process.env.DIVINITYCOIN_PARTNER_ID || "",
      webhookSecret: process.env.DIVINITYCOIN_WEBHOOK_SECRET || "",
      baseUrl: process.env.DIVINITYCOIN_API_URL || "https://divinitycoin.com/internal",
    };
    return cachedConfig;
  }

  throw new Error("DivinityCoin not configured. Please set it in Admin Settings > Payments.");
}

/**
 * Get DivinityCoin webhook secret
 */
export async function getDivinityCoinWebhookSecret(): Promise<string | null> {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { divinityCoinWebhookSecret: true, divinityCoinEnabled: true },
    });

    if (settings?.divinityCoinWebhookSecret && settings.divinityCoinEnabled) {
      return settings.divinityCoinWebhookSecret;
    }
  } catch (error) {
    paymentsDivinitycoinLogger.warn({ data: error }, "Could not fetch DivinityCoin webhook secret from database:");
  }

  return process.env.DIVINITYCOIN_WEBHOOK_SECRET || null;
}
