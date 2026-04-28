// Thin wrapper around the NMI direct-post gateway. Pulls credentials
// from PlatformSettings on every call so admins can rotate keys via
// the admin UI without a redeploy.
//
// NMI uses a single endpoint (api/transact.php) with a `type` form
// parameter that discriminates the action: sale, auth, capture, void,
// refund, credit, validate, update, plus customer_vault for tokenization.
// All requests are application/x-www-form-urlencoded; responses are
// also query-string-encoded (e.g. response=1&responsetext=APPROVED&...).
//
// Used for the NMI processor option (Mentom Payments / white-label
// resellers all funnel through NMI underneath). The pledge flow uses
// the Customer Vault tokenize-on-pledge / charge-on-success pattern
// for all-or-nothing crowdfunding.

import { db } from "@/lib/db";
import { getSecret } from "@/lib/vault";
import { logger } from "@/lib/logger";

const nmiLogger = logger.child({ module: "nmi" });

export interface NmiConfig {
  securityKey: string;
  publicKey: string | null;
  webhookSecret: string | null;
  environment: "production" | "sandbox";
  /** Final URL hit for /transact.php — production / sandbox / reseller override. */
  gatewayUrl: string;
}

export async function loadNmiConfig(): Promise<NmiConfig | null> {
  const settings = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: {
      nmiEnabled: true,
      nmiSecurityKey: true,
      nmiPublicKey: true,
      nmiWebhookSecret: true,
      nmiEnvironment: true,
      nmiGatewayUrlOverride: true,
    },
  });
  if (!settings?.nmiEnabled) return null;
  if (!settings.nmiSecurityKey) return null;

  const securityKey = getSecret("nmi_security_key", settings.nmiSecurityKey);
  if (!securityKey) return null;

  const publicKey = settings.nmiPublicKey
    ? getSecret("nmi_public_key", settings.nmiPublicKey)
    : null;

  const webhookSecret = settings.nmiWebhookSecret
    ? getSecret("nmi_webhook_secret", settings.nmiWebhookSecret)
    : null;

  const env = settings.nmiEnvironment === "sandbox" ? "sandbox" : "production";
  // Production defaults to PaymentCloud's NMI-white-label host (the
  // documented POST URL in their integration portal). Sandbox falls
  // back to NMI's shared sandbox since white-labels typically don't
  // mint a separate sandbox subdomain. Either is overridable via
  // nmiGatewayUrlOverride for any other ISO that proxies NMI.
  const defaultUrl =
    env === "sandbox"
      ? "https://sandbox.nmi.com/api/transact.php"
      : "https://paymentcloud.transactiongateway.com/api/transact.php";
  const gatewayUrl = settings.nmiGatewayUrlOverride?.trim() || defaultUrl;

  return {
    securityKey,
    publicKey,
    webhookSecret,
    environment: env,
    gatewayUrl,
  };
}

export interface NmiRequestParams {
  [key: string]: string | number | boolean | undefined | null;
}

export interface NmiResponse {
  /** "1" = approved, "2" = declined, "3" = error */
  response: string;
  responsetext: string;
  authcode?: string;
  transactionid?: string;
  customer_vault_id?: string;
  /** Raw map of every key returned by the gateway. */
  raw: Record<string, string>;
}

function parseQueryStringResponse(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(body);
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

async function nmiPost(
  config: NmiConfig,
  params: NmiRequestParams
): Promise<NmiResponse> {
  const body = new URLSearchParams();
  body.append("security_key", config.securityKey);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    body.append(k, String(v));
  }

  const res = await fetch(config.gatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    nmiLogger.error(
      { status: res.status, body: text.slice(0, 500) },
      "NMI gateway HTTP error"
    );
    throw new NmiApiError(res.status, text);
  }

  const raw = parseQueryStringResponse(text);
  if (raw.response !== "1") {
    nmiLogger.warn(
      { response: raw.response, text: raw.responsetext },
      "NMI declined or errored"
    );
  }
  return {
    response: raw.response,
    responsetext: raw.responsetext,
    authcode: raw.authcode,
    transactionid: raw.transactionid,
    customer_vault_id: raw.customer_vault_id,
    raw,
  };
}

export class NmiApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`NMI gateway ${status}: ${body.slice(0, 200)}`);
    this.name = "NmiApiError";
  }
}

// ---------------------------------------------------------------------
// Transaction helpers — type-narrowed wrappers around nmiPost.
// ---------------------------------------------------------------------

export interface SaleByTokenInput {
  amount: number;
  customerVaultId: string;
  orderid?: string;
  orderdescription?: string;
  email?: string;
}

export async function saleByVaultToken(
  config: NmiConfig,
  input: SaleByTokenInput
): Promise<NmiResponse> {
  return nmiPost(config, {
    type: "sale",
    customer_vault_id: input.customerVaultId,
    amount: input.amount.toFixed(2),
    orderid: input.orderid,
    orderdescription: input.orderdescription,
    email: input.email,
  });
}

export async function refund(
  config: NmiConfig,
  transactionId: string,
  amount?: number
): Promise<NmiResponse> {
  return nmiPost(config, {
    type: "refund",
    transactionid: transactionId,
    amount: amount === undefined ? undefined : amount.toFixed(2),
  });
}

export async function voidTransaction(
  config: NmiConfig,
  transactionId: string
): Promise<NmiResponse> {
  return nmiPost(config, {
    type: "void",
    transactionid: transactionId,
  });
}

export async function captureAuth(
  config: NmiConfig,
  transactionId: string,
  amount: number
): Promise<NmiResponse> {
  return nmiPost(config, {
    type: "capture",
    transactionid: transactionId,
    amount: amount.toFixed(2),
  });
}

// ---------------------------------------------------------------------
// Customer Vault — store cards once, charge later. This is what we use
// for all-or-nothing crowdfunding.
//
// Tokenization itself happens in the browser via Collect.js so the
// PAN never touches our server. The browser POSTs the resulting
// `payment_token` to our server, which then calls add_customer below
// to persist it server-side and get back a stable customer_vault_id.
// ---------------------------------------------------------------------

export interface AddCustomerInput {
  paymentToken: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export async function addCustomerToVault(
  config: NmiConfig,
  input: AddCustomerInput
): Promise<NmiResponse> {
  return nmiPost(config, {
    customer_vault: "add_customer",
    payment_token: input.paymentToken,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    address1: input.address1,
    city: input.city,
    state: input.state,
    zip: input.zip,
    country: input.country,
  });
}

export async function deleteVaultCustomer(
  config: NmiConfig,
  customerVaultId: string
): Promise<NmiResponse> {
  return nmiPost(config, {
    customer_vault: "delete_customer",
    customer_vault_id: customerVaultId,
  });
}

// Run a zero-cost auth-and-void to confirm a saved vault entry is a
// real, chargeable card. Used at creator chargeback-card save time so
// invalid/declined cards are caught up front instead of failing during
// a real chargeback recoup.
export async function validateVaultCard(
  config: NmiConfig,
  customerVaultId: string
): Promise<NmiResponse> {
  return nmiPost(config, {
    type: "validate",
    customer_vault_id: customerVaultId,
  });
}
