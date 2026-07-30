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

// File URLs from PC (proofs, artwork) are opaque and come in three shapes
// (docs § Files, 2026-07-29): an absolute CDN URL, "/api/files/…" (302s to a
// short-lived signed link), or "/uploads/…?t=…". The two relative shapes are
// relative to PC's ORIGIN — rendering them as-is in our UI resolved them
// against indiecrowdfund.com and 404'd. Prefix the origin, change nothing
// else, and never construct a file path ourselves.
//
// Only the opaque URL is safe to persist: the signed destination behind a
// /api/files/ redirect expires, so store what PC gave us and let the browser
// follow the 302 each time.
export function resolveFileUrl(
  config: PrintingComicsConfig,
  url: string | null | undefined
): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  const origin = config.baseUrl.replace(/\/api\/v\d+\/?$/, "");
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

// PC returns 410 Gone (not 404) once a file's contents have been removed —
// artwork and proofs are deleted when an order reaches SHIPPED. The creator
// needs to re-upload; retrying the same fetch will never succeed.
export function isFileGone(err: unknown): boolean {
  return err instanceof PrintingComicsApiError && err.status === 410;
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
  // Per PrintingComics 2026-05-01 update: tag every order with the
  // creator's campaign id so paid revenue rolls up by project on
  // their side. We pass our internal Project.id; their server
  // auto-upserts a project row keyed by (partner, externalProjectId)
  // if you don't pre-register via POST /projects.
  projectId?: string;
  email: string;
  customerName?: string;
  shippingAddress: PCAddress;
  items: PCOrderItemInput[];
  shippingRateId?: string;
  couponCode?: string;
  notes?: string;
  markAsPaid?: boolean;
  // Default true; set false to skip auto-generating the PayPal
  // approval URL on order create (mint on demand via createPaymentLink).
  generatePaymentLink?: boolean;
}

export interface PCPaymentLink {
  provider: "paypal" | "manual";
  approvalUrl: string;
  expiresAt: string;          // ISO 8601
  amountCents: number;
}

export interface PCPayment {
  status: "unpaid" | "pending" | "paid" | "failed" | "refunded";
  amountCents: number;
  provider: "paypal" | "manual" | null;
  providerRef?: string | null; // PayPal order id while pending, capture id once paid
  paidAt?: string | null;
  hasPendingApproval?: boolean;
}

export interface PCOrder {
  id: string;
  number: string;
  externalRef?: string;
  projectId?: string;
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

export interface PCCreateOrderResponse {
  order: PCOrder;
  payment?: PCPaymentLink;     // present when generatePaymentLink !== false and order isn't markAsPaid
  idempotent?: boolean;
}

export async function createOrder(
  config: PrintingComicsConfig,
  input: PCCreateOrderInput
): Promise<PCCreateOrderResponse> {
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

// ──────────────────────────────────────────────────────────────────
// Projects (creator campaigns)
// ──────────────────────────────────────────────────────────────────

export interface PCProjectInput {
  externalProjectId: string;     // our Project.id
  title?: string;
  url?: string;
  creatorName?: string;
  creatorEmail?: string;
  status?: "active" | "completed" | "cancelled";
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface PCProject {
  id: string;
  externalProjectId: string;
  title?: string;
  url?: string;
  creatorName?: string;
  creatorEmail?: string;
  status?: "active" | "completed" | "cancelled";
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

// POST /projects is an upsert keyed on (partner, externalProjectId),
// safe to call before every order so creator info stays fresh.
export async function upsertProject(
  config: PrintingComicsConfig,
  input: PCProjectInput
): Promise<{ project: PCProject }> {
  return pcFetch(config, { method: "POST", path: "/projects", body: input });
}

// ──────────────────────────────────────────────────────────────────
// Payments
// ──────────────────────────────────────────────────────────────────

export async function getPayment(
  config: PrintingComicsConfig,
  idOrNumber: string
): Promise<{ payment: PCPayment }> {
  return pcFetch(config, {
    method: "GET",
    path: `/orders/${encodeURIComponent(idOrNumber)}/payment`,
  });
}

// Mint a fresh PayPal approval URL for an unpaid order. Existing
// pending PayPal orders on the same Printing Comics order are
// invalidated — only the latest URL works.
export async function refreshPaymentLink(
  config: PrintingComicsConfig,
  idOrNumber: string,
  options?: { returnUrl?: string; cancelUrl?: string }
): Promise<{ payment: PCPaymentLink }> {
  return pcFetch(config, {
    method: "POST",
    path: `/orders/${encodeURIComponent(idOrNumber)}/payment-link`,
    body: options || {},
  });
}

// Assert the order has been paid out-of-band (wire / ACH / internal
// billing). Flips order to PAID/CAPTURED and fires order.paid.
export async function markOrderPaid(
  config: PrintingComicsConfig,
  idOrNumber: string,
  body: { reference?: string; amountCents?: number; note?: string }
): Promise<{ payment: PCPayment }> {
  return pcFetch(config, {
    method: "POST",
    path: `/orders/${encodeURIComponent(idOrNumber)}/mark-paid`,
    body,
  });
}

// Pricing quote — runs the same pipeline the storefront cart uses, so
// what the creator is quoted is what they'll be charged. Includes
// per-line breakdown (qty discount tier, page upgrades, option
// modifiers), live shipping options for the destination country, and
// computed tax.
export interface PCQuoteAddress {
  country: string;
  region?: string;
  postalCode?: string;
}
export interface PCQuoteInput {
  items: Array<{
    productSlug: string;
    quantity: number;
    options: Record<string, string | number>;
  }>;
  shippingAddress?: PCQuoteAddress;
  shippingRateId?: string;
  couponCode?: string;
}
export interface PCQuoteShippingOption {
  // Opaque since PC's 2026-07-27 switch to live carrier rates (e.g.
  // "ep:UPS:Ground"). Never parse or construct it — pass it back verbatim as
  // shippingRateId.
  id: string;
  name: string;
  rateCents: number;
  estimatedDays?: string;
  // "live" = real carrier rate for the actual parcel; "table" = fallback flat
  // rate, which is what you get when the shippingAddress is incomplete (no
  // postal code). Surface the difference so creators don't budget off a
  // fallback number.
  source?: "live" | "table";
  carrier?: string;
  service?: string;
}
export interface PCQuoteLine {
  productSlug: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  breakdown?: {
    baseCents?: number;
    modifierCents?: Record<string, number>;
    pagesCents?: number;
    combinedListCents?: number;
    discountBps?: number;
    unitCents?: number;
    totalCents?: number;
  };
}
export interface PCQuoteResponse {
  items: PCQuoteLine[];
  subtotalCents: number;
  discountCents: number;
  shippingOptions: PCQuoteShippingOption[];
  shippingCents?: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  // Live-rate metadata (PC 2026-07-27). Quantity now affects shipping cost,
  // so a quote is only good for the parcel it was priced against — re-quote
  // close to order time. PC re-rates server-side at order creation anyway.
  //
  // NOTE: as of printingcomics @ claude/merge-crowdfunding-admin-0r4pi these
  // are returned by their STOREFRONT checkout; the partner /pricing/quote
  // still serves flat shippingZone/shippingRate rows and omits them. Optional
  // here so we light up automatically if/when the partner route adopts
  // lib/shipping-quote.ts.
  shipmentWeightOz?: number;
  /** Number of boxes the shipment packs into — a count, not a list. */
  boxes?: number;
}
export async function quotePricing(
  config: PrintingComicsConfig,
  input: PCQuoteInput
): Promise<PCQuoteResponse> {
  return pcFetch<PCQuoteResponse>(config, {
    method: "POST",
    path: "/pricing/quote",
    body: input,
  });
}
