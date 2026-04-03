import Whop from "@whop/sdk";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const whopConfigLogger = logger.child({ module: "whop-config" });

export interface WhopConfig {
  apiKey: string;
  planId: string;
  companyId: string;
  webhookSecret: string;
  environment: "production" | "sandbox";
}

let cachedConfig: WhopConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

export async function getWhopConfig(): Promise<WhopConfig> {
  if (cachedConfig && Date.now() < cacheExpiry) return cachedConfig;

  try {
    const settings = await db.platformSettings.findUnique({ where: { id: "default" } });

    const apiKey = settings?.whopApiKey || process.env.WHOP_API_KEY || "";
    const planId = settings?.whopPlanId || process.env.WHOP_PLAN_ID || "";
    const companyId = settings?.whopCompanyId || process.env.WHOP_COMPANY_ID || "";
    const webhookSecret = settings?.whopWebhookSecret || process.env.WHOP_WEBHOOK_SECRET || "";
    const environment = (settings?.whopEnvironment || process.env.WHOP_ENVIRONMENT || "production") as "production" | "sandbox";

    if (!apiKey || !planId || !companyId) {
      throw new Error("Whop credentials not configured");
    }

    cachedConfig = { apiKey, planId, companyId, webhookSecret, environment };
    cacheExpiry = Date.now() + CACHE_TTL;
    return cachedConfig;
  } catch (error) {
    whopConfigLogger.error({ err: String(error) }, "Failed to load Whop config");
    throw error;
  }
}

/** Returns an initialized Whop SDK client using the stored API key */
export async function getWhopClient(): Promise<InstanceType<typeof Whop>> {
  const config = await getWhopConfig();
  return new Whop({ apiKey: `Bearer ${config.apiKey}` });
}

export function invalidateWhopConfigCache() {
  cachedConfig = null;
  cacheExpiry = 0;
}

/** Verify Whop webhook signature using HMAC-SHA256 */
export async function verifyWhopWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expectedSig = Buffer.from(signatureBuffer).toString("hex");
    const receivedSig = signature.startsWith("sha256=") ? signature.slice(7) : signature;

    return expectedSig === receivedSig;
  } catch {
    return false;
  }
}
