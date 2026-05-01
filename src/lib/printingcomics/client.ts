// Typed HTTP client for the Printing Comics API. Handles bearer auth,
// optional HMAC request signing, and JSON / multipart request bodies.
//
// Per docs (printingcomics.com/developers):
//   Authorization: Bearer pc_live_xxxxxxxxxxxxxxxx
//   X-PC-Request-Signature: t=<unix>,v1=<hex>  (optional, required when
//                                               the key has requireRequestSigning)
//   v1 = HMAC-SHA256(signingSecret, `${t}.${rawBody}`)
//   timestamp must be within 5 minutes of server time.

import { createHmac } from "node:crypto";
import { logger } from "@/lib/logger";
import type { PrintingComicsConfig } from "./config";

const log = logger.child({ module: "printingcomics" });

export class PrintingComicsApiError extends Error {
  constructor(public status: number, public bodyText: string) {
    super(`Printing Comics ${status}: ${bodyText.slice(0, 300)}`);
    this.name = "PrintingComicsApiError";
  }
}

interface PCRequestInit {
  method: "GET" | "POST" | "DELETE";
  path: string;            // e.g. "/orders" — joined with config.baseUrl
  body?: unknown;          // serialized as JSON
  // For multipart endpoints (uploads). When set, body is sent as-is
  // and Content-Type/X-PC-Request-Signature are NOT added. We let
  // fetch infer the multipart boundary from the FormData itself.
  multipart?: FormData;
  // Extra headers — used by the upload endpoint for X-Upload-Content-Hash.
  extraHeaders?: Record<string, string>;
}

// Sign a JSON payload per the docs:
//   X-PC-Request-Signature: t=<unix>,v1=<hex>
//   v1 = HMAC-SHA256(signingSecret, `${t}.${rawBody}`)
// Caller must serialize the body ONCE and pass the same string here
// + as the request body so the signature matches what the server sees.
export function signRequest(signingSecret: string, rawBody: string): string {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", signingSecret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  return `t=${t},v1=${v1}`;
}

export async function pcFetch<T = unknown>(
  config: PrintingComicsConfig,
  init: PCRequestInit
): Promise<T> {
  const url = config.baseUrl + init.path;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: "application/json",
    ...(init.extraHeaders || {}),
  };

  let body: string | FormData | undefined;
  if (init.multipart) {
    body = init.multipart;
    // Don't set Content-Type — fetch picks the boundary itself.
    // Don't sign multipart requests — the docs only define signing
    // over the raw body, and a stable serialization isn't possible
    // for FormData. Their server documents signing as optional
    // anyway; we still send the bearer key.
  } else if (init.body !== undefined) {
    const raw = JSON.stringify(init.body);
    body = raw;
    headers["Content-Type"] = "application/json";
    if (config.signingSecret) {
      headers["X-PC-Request-Signature"] = signRequest(config.signingSecret, raw);
    }
  }

  const res = await fetch(url, { method: init.method, headers, body });
  const text = await res.text();
  if (!res.ok) {
    log.warn(
      { status: res.status, path: init.path, body: text.slice(0, 500) },
      "Printing Comics request failed"
    );
    throw new PrintingComicsApiError(res.status, text);
  }
  if (!text) return undefined as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new PrintingComicsApiError(res.status, `Non-JSON response: ${text.slice(0, 200)}`);
  }
}

// ──────────────────────────────────────────────────────────────────
// Typed wrappers around the most-used endpoints.
// ──────────────────────────────────────────────────────────────────

export interface PCWhoami {
  name?: string;
  scopes?: string[];
  // Provider may add fields; pass-through anything extra.
  [k: string]: unknown;
}

export async function whoami(config: PrintingComicsConfig): Promise<PCWhoami> {
  return pcFetch<PCWhoami>(config, { method: "GET", path: "/me" });
}

export interface PCAddress {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface PCOrderItemFile {
  uploadId: string;
  purpose: string;  // "cover" | "interior" | etc — free-form per docs
}

export interface PCOrderItemInput {
  productSlug: string;
  quantity: number;
  options: Record<string, string | number>;
  files?: PCOrderItemFile[];
}

export interface PCCreateOrderInput {
  externalRef: string;        // platform-side stable id (pledge id)
  email: string;
  customerName?: string;
  shippingAddress: PCAddress;
  items: PCOrderItemInput[];
  shippingRateId?: string;
  couponCode?: string;
  notes?: string;
  markAsPaid?: boolean;
}

export interface PCOrder {
  id: string;
  number: string;
  externalRef?: string;
  status: "PENDING" | "PAID" | "IN_PRODUCTION" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
  paymentStatus: "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  shippingMethod?: string;
  trackingNumber?: string;
  items: Array<{
    productId: string;
    variantId?: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    options?: Record<string, unknown>;
    files?: Array<{
      uploadId: string;
      url: string;
      filename: string;
      size: number;
      mimeType: string;
      contentHash: string;
      purpose?: string;
      notes?: string;
    }>;
  }>;
}

export async function createOrder(
  config: PrintingComicsConfig,
  input: PCCreateOrderInput
): Promise<{ order: PCOrder; idempotent?: boolean }> {
  return pcFetch(config, { method: "POST", path: "/orders", body: input });
}

export async function getOrder(
  config: PrintingComicsConfig,
  idOrNumberOrExternalRef: string
): Promise<{ order: PCOrder }> {
  return pcFetch(config, {
    method: "GET",
    path: `/orders/${encodeURIComponent(idOrNumberOrExternalRef)}`,
  });
}

export async function cancelOrder(
  config: PrintingComicsConfig,
  idOrNumber: string,
  reason?: string
): Promise<{ order: PCOrder }> {
  return pcFetch(config, {
    method: "POST",
    path: `/orders/${encodeURIComponent(idOrNumber)}/cancel`,
    body: reason ? { reason } : {},
  });
}
