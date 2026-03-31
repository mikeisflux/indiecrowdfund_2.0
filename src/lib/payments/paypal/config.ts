import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const paypalConfigLogger = logger.child({ module: "paypal-config" });

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  webhookId: string;
  baseUrl: string;
}

let cachedConfig: PayPalConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

export async function getPayPalConfig(): Promise<PayPalConfig> {
  if (cachedConfig && Date.now() < cacheExpiry) return cachedConfig;

  try {
    const settings = await db.platformSettings.findUnique({ where: { id: "default" } });

    const clientId = settings?.paypalClientId || process.env.PAYPAL_CLIENT_ID || "";
    const clientSecret = settings?.paypalClientSecret || process.env.PAYPAL_CLIENT_SECRET || "";
    const webhookId = settings?.paypalWebhookId || process.env.PAYPAL_WEBHOOK_ID || "";
    const mode = settings?.paypalMode || process.env.PAYPAL_MODE || "live";

    if (!clientId || !clientSecret) {
      throw new Error("PayPal credentials not configured");
    }

    const baseUrl =
      mode === "sandbox"
        ? "https://api-m.sandbox.paypal.com"
        : "https://api-m.paypal.com";

    cachedConfig = { clientId, clientSecret, webhookId, baseUrl };
    cacheExpiry = Date.now() + CACHE_TTL;
    return cachedConfig;
  } catch (error) {
    paypalConfigLogger.error({ err: String(error) }, "Failed to load PayPal config");
    throw error;
  }
}

/** Returns a short-lived OAuth2 access token for server-side PayPal API calls */
export async function getPayPalAccessToken(): Promise<string> {
  const config = await getPayPalConfig();
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  const res = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal auth failed: ${err}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

/** Invalidate the config cache (call after admin updates settings) */
export function invalidatePayPalConfigCache() {
  cachedConfig = null;
  cacheExpiry = 0;
}
