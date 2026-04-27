// Thin wrapper around the Maverick Payments gateway. Pulls credentials
// from PlatformSettings on every call so admins can rotate keys via the
// admin UI without a redeploy.
//
// Used for the Maverick payment processor option (Mentom Payments
// merchant account piped through Maverick). The pledge flow tokenizes
// the card via the Hosted Card Form at pledge time and charges the
// stored token on campaign success — Maverick's auth-only window is
// only ~10 days so we use the Customer Vault pattern instead of
// auth+capture.

import { db } from "@/lib/db";
import { getSecret } from "@/lib/vault";
import { logger } from "@/lib/logger";

const maverickLogger = logger.child({ module: "maverick" });

export interface MaverickConfig {
  apiToken: string;
  webhookSecret: string | null;
  dbaId: string | null;
  terminalId: string | null;
  environment: "production" | "sandbox";
  gatewayBaseUrl: string;
  dashboardBaseUrl: string;
}

export async function loadMaverickConfig(): Promise<MaverickConfig | null> {
  const settings = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: {
      maverickEnabled: true,
      maverickApiToken: true,
      maverickWebhookSecret: true,
      maverickDbaId: true,
      maverickTerminalId: true,
      maverickEnvironment: true,
    },
  });
  if (!settings?.maverickEnabled) return null;
  if (!settings.maverickApiToken) return null;

  const apiToken = getSecret("maverick_api_token", settings.maverickApiToken);
  if (!apiToken) return null;

  const webhookSecret = settings.maverickWebhookSecret
    ? getSecret("maverick_webhook_secret", settings.maverickWebhookSecret)
    : null;

  const env = settings.maverickEnvironment === "sandbox" ? "sandbox" : "production";
  const gatewayBaseUrl =
    env === "sandbox"
      ? "https://sandbox-gateway.maverickpayments.com"
      : "https://gateway.maverickpayments.com";
  const dashboardBaseUrl =
    env === "sandbox"
      ? "https://sandbox-dashboard.maverickpayments.com"
      : "https://dashboard.maverickpayments.com";

  return {
    apiToken,
    webhookSecret,
    dbaId: settings.maverickDbaId ?? null,
    terminalId: settings.maverickTerminalId ?? null,
    environment: env,
    gatewayBaseUrl,
    dashboardBaseUrl,
  };
}

interface FetchOptions extends Omit<RequestInit, "headers" | "body"> {
  body?: Record<string, unknown> | string;
  query?: Record<string, string | number | undefined>;
}

// Generic gateway/dashboard fetcher. The Maverick API uses Bearer auth
// and accepts both form-encoded and JSON bodies; we send JSON for
// readability and let the gateway content-negotiate.
async function maverickFetch<T>(
  config: MaverickConfig,
  base: "gateway" | "dashboard",
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { body, query, ...init } = options;
  const url = new URL(
    path,
    base === "gateway" ? config.gatewayBaseUrl : config.dashboardBaseUrl
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    maverickLogger.error(
      { status: res.status, path, body: text.slice(0, 500) },
      "Maverick API error"
    );
    throw new MaverickApiError(res.status, path, text);
  }
  return (await res.json()) as T;
}

export class MaverickApiError extends Error {
  constructor(
    public status: number,
    public path: string,
    public body: string
  ) {
    super(`Maverick API ${status} on ${path}: ${body.slice(0, 200)}`);
    this.name = "MaverickApiError";
  }
}

// ---------------------------------------------------------------------
// Payment endpoints
// ---------------------------------------------------------------------

export interface MaverickSaleRequest {
  amount: number;
  source: "card" | "token";
  token?: string;
  card?: { number: string; expiration: string; cvv?: string };
  terminal?: { id: number };
  order?: { description?: string };
  customer?: { id?: number };
}

export interface MaverickSaleResponse {
  id: string;
  status: string;
  amount: string;
  [k: string]: unknown;
}

export async function createSale(
  config: MaverickConfig,
  payload: MaverickSaleRequest
): Promise<MaverickSaleResponse> {
  return maverickFetch<MaverickSaleResponse>(config, "gateway", "/payment/sale", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  });
}

export async function refundTransaction(
  config: MaverickConfig,
  transactionId: string,
  amount?: number
): Promise<MaverickSaleResponse> {
  return maverickFetch<MaverickSaleResponse>(
    config,
    "gateway",
    `/payment/${encodeURIComponent(transactionId)}/refund`,
    {
      method: "POST",
      body: amount === undefined ? {} : { amount },
    }
  );
}

export async function getTransaction(
  config: MaverickConfig,
  transactionId: string
): Promise<MaverickSaleResponse> {
  return maverickFetch<MaverickSaleResponse>(
    config,
    "gateway",
    `/payment/${encodeURIComponent(transactionId)}`,
    { method: "GET" }
  );
}

// ---------------------------------------------------------------------
// Customer Vault — store cards once, charge later. This is what we use
// for all-or-nothing crowdfunding (tokenize at pledge, charge on
// campaign success).
// ---------------------------------------------------------------------

export interface MaverickCustomer {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  identificator?: string;
}

export async function createCustomer(
  config: MaverickConfig,
  payload: Partial<MaverickCustomer> & { email: string; identificator: string }
): Promise<MaverickCustomer> {
  if (!config.dbaId) throw new Error("maverickDbaId not configured");
  return maverickFetch<MaverickCustomer>(
    config,
    "dashboard",
    "/api/customer-vault",
    {
      method: "POST",
      body: { dba: { id: Number(config.dbaId) }, ...payload },
    }
  );
}

export async function chargeStoredCard(
  config: MaverickConfig,
  customerId: number,
  cardId: number,
  amount: number,
  description?: string
): Promise<MaverickSaleResponse> {
  // Vault charge piggybacks on /payment/sale with source=token.
  return createSale(config, {
    amount,
    source: "token",
    token: `${customerId}:${cardId}`,
    terminal: config.terminalId
      ? { id: Number(config.terminalId) }
      : undefined,
    order: description ? { description } : undefined,
  });
}

// ---------------------------------------------------------------------
// Webhook signature verification
// SHA-512 over `<webhookSecret><id><module><action><date>`
// ---------------------------------------------------------------------

import { createHash, timingSafeEqual } from "crypto";

export function verifyWebhookSignature(
  secret: string,
  signatureHeader: string,
  event: { id: string | number; module: string; action: string; date: string }
): boolean {
  const expected = createHash("sha512")
    .update(`${secret}${event.id}${event.module}${event.action}${event.date}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(signatureHeader.toLowerCase(), "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
