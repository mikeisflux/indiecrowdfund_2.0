import { db } from "@/lib/db";
import crypto from "crypto";

// DivinityCoin API configuration
interface DivinityCoinConfig {
  apiKey: string;
  partnerId: string;
  webhookSecret: string;
  baseUrl: string;
}

let cachedConfig: DivinityCoinConfig | null = null;

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
      cachedConfig = {
        apiKey: settings.divinityCoinApiKey,
        partnerId: settings.divinityCoinPartnerId || "",
        webhookSecret: settings.divinityCoinWebhookSecret || "",
        baseUrl: process.env.DIVINITYCOIN_API_URL || "https://api.divinitycoin.com/v1",
      };
      return cachedConfig;
    }
  } catch (error) {
    console.warn("Could not fetch DivinityCoin settings from database:", error);
  }

  // Fall back to environment variables
  if (process.env.DIVINITYCOIN_API_KEY) {
    cachedConfig = {
      apiKey: process.env.DIVINITYCOIN_API_KEY,
      partnerId: process.env.DIVINITYCOIN_PARTNER_ID || "",
      webhookSecret: process.env.DIVINITYCOIN_WEBHOOK_SECRET || "",
      baseUrl: process.env.DIVINITYCOIN_API_URL || "https://api.divinitycoin.com/v1",
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
    console.warn("Could not fetch DivinityCoin webhook secret from database:", error);
  }

  return process.env.DIVINITYCOIN_WEBHOOK_SECRET || null;
}

/**
 * Clear cached config (call when settings are updated)
 */
export function clearDivinityCoinConfigCache(): void {
  cachedConfig = null;
}

// Webhook event types supported by DivinityCoin
export type DivinityCoinEventType =
  | "test.ping"
  | "card.validate"
  | "card.redeem";

// Webhook request structure from DivinityCoin
export interface DivinityCoinWebhookRequest {
  event: DivinityCoinEventType;
  data?: {
    cardCode?: string;
    platformUserId?: string;
    [key: string]: unknown;
  };
}

// Webhook response structures
export interface TestPingResponse {
  success: true;
  message: string;
  partnerId: string;
  sandboxMode: boolean;
}

export interface CardValidateResponse {
  valid: boolean;
  status: string;
  amount: number;
  error?: string;
}

export interface CardRedeemResponse {
  success: boolean;
  amount: number;
  newBalance?: number;
  error?: string;
}

/**
 * Verify webhook signature from DivinityCoin
 * Format: X-Webhook-Signature: t=timestamp,v1=hmac_signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Parse signature header: t=timestamp,v1=signature
  const parts = signature.split(",");
  const timestampPart = parts.find((p) => p.startsWith("t="));
  const signaturePart = parts.find((p) => p.startsWith("v1="));

  if (!timestampPart || !signaturePart) {
    console.warn("[DivinityCoin] Invalid signature format");
    return false;
  }

  const timestamp = timestampPart.substring(2);
  const providedSignature = signaturePart.substring(3);

  // Check timestamp is within 5 minutes (300 seconds)
  const timestampAge = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (timestampAge > 300) {
    console.warn("[DivinityCoin] Webhook timestamp too old:", timestampAge, "seconds");
    return false;
  }

  // Compute expected signature: HMAC-SHA256(timestamp.payload, secret)
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Construct and verify a webhook event
 */
export async function constructWebhookEvent(
  payload: string,
  signature: string
): Promise<DivinityCoinWebhookRequest> {
  const secret = await getDivinityCoinWebhookSecret();

  if (!secret) {
    throw new Error("DivinityCoin webhook secret not configured");
  }

  if (!verifyWebhookSignature(payload, signature, secret)) {
    throw new Error("Invalid webhook signature");
  }

  return JSON.parse(payload) as DivinityCoinWebhookRequest;
}

/**
 * Make an API request to DivinityCoin
 */
async function apiRequest<T>(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>
): Promise<T> {
  const config = await getDivinityCoinConfig();

  const response = await fetch(`${config.baseUrl}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
      "X-Partner-ID": config.partnerId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DivinityCoin API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Register or update webhook URL with DivinityCoin
 * This configures where DivinityCoin will send webhook events
 */
export async function registerWebhook(webhookUrl: string): Promise<{
  success: boolean;
  webhookId?: string;
  secret?: string;
  message?: string;
}> {
  try {
    const result = await apiRequest<{
      success: boolean;
      webhookId: string;
      secret: string;
    }>("POST", "/webhooks", {
      url: webhookUrl,
      events: ["test.ping", "card.validate", "card.redeem"],
    });

    // Store the webhook secret in platform settings if provided
    if (result.secret) {
      await db.platformSettings.update({
        where: { id: "default" },
        data: {
          divinityCoinWebhookSecret: result.secret,
        },
      });

      // Clear cache so new secret is used
      clearDivinityCoinConfigCache();
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register webhook";
    return { success: false, message };
  }
}

/**
 * Get current webhook configuration from DivinityCoin
 */
export async function getWebhookConfig(): Promise<{
  url: string | null;
  events: string[];
  status: "active" | "disabled" | "not_configured";
} | null> {
  try {
    const result = await apiRequest<{
      url: string;
      events: string[];
      status: "active" | "disabled";
    }>("GET", "/webhooks");

    return result;
  } catch {
    return null;
  }
}

/**
 * Update webhook URL
 */
export async function updateWebhookUrl(webhookUrl: string): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    await apiRequest("PATCH", "/webhooks", {
      url: webhookUrl,
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update webhook";
    return { success: false, message };
  }
}

/**
 * Validate a DivinityCoin gift card (without redeeming)
 */
export async function validateCard(cardCode: string): Promise<CardValidateResponse> {
  return apiRequest<CardValidateResponse>("POST", "/cards/validate", {
    cardCode,
  });
}

/**
 * Redeem a DivinityCoin gift card
 */
export async function redeemCard(
  cardCode: string,
  platformUserId?: string
): Promise<CardRedeemResponse> {
  return apiRequest<CardRedeemResponse>("POST", "/cards/redeem", {
    cardCode,
    platformUserId,
  });
}

/**
 * Handle test.ping webhook event
 */
export function handleTestPing(): TestPingResponse {
  const config = cachedConfig;
  return {
    success: true,
    message: "Webhook received successfully",
    partnerId: config?.partnerId || "unknown",
    sandboxMode: process.env.NODE_ENV !== "production",
  };
}

/**
 * Handle card.validate webhook event
 * This is called by DivinityCoin to validate a card on our platform
 */
export async function handleCardValidate(
  cardCode: string
): Promise<CardValidateResponse> {
  try {
    // Call DivinityCoin API to validate the card
    const result = await validateCard(cardCode);
    return result;
  } catch (error) {
    return {
      valid: false,
      status: "error",
      amount: 0,
      error: error instanceof Error ? error.message : "Validation failed",
    };
  }
}

/**
 * Handle card.redeem webhook event
 * This is called by DivinityCoin when a card is redeemed
 */
export async function handleCardRedeem(
  cardCode: string,
  platformUserId?: string
): Promise<CardRedeemResponse> {
  try {
    // In sandbox mode, just validate without redeeming
    if (process.env.NODE_ENV !== "production") {
      const validation = await validateCard(cardCode);
      return {
        success: validation.valid,
        amount: validation.amount,
        error: validation.error,
      };
    }

    // In production, actually redeem the card
    const result = await redeemCard(cardCode, platformUserId);

    // If redemption successful and we have a platform user, credit their account
    if (result.success && platformUserId) {
      // Log the redemption for admin tracking
      console.log(
        `[DivinityCoin] Card redeemed: ${cardCode.substring(0, 4)}****${cardCode.slice(-4)} ` +
        `for user ${platformUserId}, amount: ${result.amount}`
      );
    }

    return result;
  } catch (error) {
    return {
      success: false,
      amount: 0,
      error: error instanceof Error ? error.message : "Redemption failed",
    };
  }
}

/**
 * Main webhook event handler
 * Processes incoming webhook requests from DivinityCoin
 */
export async function handleDivinityCoinWebhook(
  request: DivinityCoinWebhookRequest
): Promise<TestPingResponse | CardValidateResponse | CardRedeemResponse> {
  console.log(`[DivinityCoin Webhook] Received event: ${request.event}`);

  switch (request.event) {
    case "test.ping":
      return handleTestPing();

    case "card.validate":
      if (!request.data?.cardCode) {
        return {
          valid: false,
          status: "error",
          amount: 0,
          error: "Card code is required",
        };
      }
      return handleCardValidate(request.data.cardCode);

    case "card.redeem":
      if (!request.data?.cardCode) {
        return {
          success: false,
          amount: 0,
          error: "Card code is required",
        };
      }
      return handleCardRedeem(
        request.data.cardCode,
        request.data.platformUserId
      );

    default:
      console.warn(`[DivinityCoin Webhook] Unknown event type: ${request.event}`);
      return {
        success: false,
        amount: 0,
        error: `Unknown event type: ${request.event}`,
      } as CardRedeemResponse;
  }
}
