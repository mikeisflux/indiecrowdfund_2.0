import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const paypalConnectConfigLogger = logger.child({ module: "paypal-connect-config" });

/**
 * PayPal Connect (Complete Payments Platform) configuration.
 *
 * This is the platform's *partner* (PPCP) REST app — entirely separate from the
 * standard PayPal app used by `@/lib/payments/paypal`. It carries the extra
 * marketplace fields: the BN code (PayPal-Partner-Attribution-Id) and the
 * platform's own PayPal merchant id (used for seller-status lookups).
 */
export interface PayPalConnectConfig {
  clientId: string;
  clientSecret: string;
  bnCode: string;
  partnerMerchantId: string;
  webhookId: string;
  baseUrl: string;
  isLive: boolean;
}

let cachedConfig: PayPalConnectConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

export async function getPayPalConnectConfig(): Promise<PayPalConnectConfig> {
  if (cachedConfig && Date.now() < cacheExpiry) return cachedConfig;

  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        paypalConnectClientId: true,
        paypalConnectClientSecret: true,
        paypalConnectBnCode: true,
        paypalConnectPartnerMerchantId: true,
        paypalConnectWebhookId: true,
        paypalConnectMode: true,
      },
    });

    const clientId = settings?.paypalConnectClientId || process.env.PAYPAL_CONNECT_CLIENT_ID || "";
    const clientSecret =
      settings?.paypalConnectClientSecret || process.env.PAYPAL_CONNECT_CLIENT_SECRET || "";
    const bnCode = settings?.paypalConnectBnCode || process.env.PAYPAL_CONNECT_BN_CODE || "";
    const partnerMerchantId =
      settings?.paypalConnectPartnerMerchantId || process.env.PAYPAL_CONNECT_PARTNER_MERCHANT_ID || "";
    const webhookId = settings?.paypalConnectWebhookId || process.env.PAYPAL_CONNECT_WEBHOOK_ID || "";
    const mode = settings?.paypalConnectMode || process.env.PAYPAL_CONNECT_MODE || "live";

    if (!clientId || !clientSecret) {
      throw new Error("PayPal Connect credentials not configured");
    }

    const isLive = mode !== "sandbox";
    const baseUrl = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    cachedConfig = { clientId, clientSecret, bnCode, partnerMerchantId, webhookId, baseUrl, isLive };
    cacheExpiry = Date.now() + CACHE_TTL;
    return cachedConfig;
  } catch (error) {
    paypalConnectConfigLogger.error({ err: String(error) }, "Failed to load PayPal Connect config");
    throw error;
  }
}

/** Short-lived OAuth2 access token for the platform partner app. */
export async function getPayPalConnectAccessToken(): Promise<string> {
  const config = await getPayPalConnectConfig();
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
    throw new Error(`PayPal Connect auth failed: ${err}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

/**
 * Standard headers for every PPCP call. The BN code is required on partner
 * calls for revenue attribution and reporting.
 */
export async function payPalConnectHeaders(): Promise<Record<string, string>> {
  const [config, accessToken] = await Promise.all([
    getPayPalConnectConfig(),
    getPayPalConnectAccessToken(),
  ]);
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "PayPal-Partner-Attribution-Id": config.bnCode,
  };
}

export function invalidatePayPalConnectConfigCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
}
