// Loader for the Printing Comics fulfillment integration. Mirrors
// loadNmiConfig — pulls credentials from PlatformSettings on every
// call so admins can rotate keys via the admin UI without a redeploy.
//
// Auth: every request carries `Authorization: Bearer pc_live_…`.
// Mutating requests can additionally be HMAC-signed against the
// signingSecret (pcs_…) — required only after the partner asks
// support to flip `requireRequestSigning` on the key. We always sign
// when a secret is present so we're forward-compat.
//
// Per docs (printingcomics.com/developers): base URL is
// https://printingcomics.com/api/v1, rate limit 300 req/min/key.

import { db } from "@/lib/db";
import { getSecret } from "@/lib/vault";

export interface PrintingComicsConfig {
  apiKey: string;                 // pc_live_... or pc_test_...
  signingSecret: string | null;   // pcs_... — used for X-PC-Request-Signature when present
  webhookSecret: string | null;   // shared secret for verifying inbound order.* webhooks
  environment: "production" | "sandbox";
  baseUrl: string;                // currently always https://printingcomics.com/api/v1
}

export async function loadPrintingComicsConfig(): Promise<PrintingComicsConfig | null> {
  const settings = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: {
      printingComicsApiKey: true,
      printingComicsWebhookSecret: true,
      printingComicsEnvironment: true,
    },
  });
  if (!settings?.printingComicsApiKey) return null;

  const apiKey = getSecret("printingcomics_api_key", settings.printingComicsApiKey);
  if (!apiKey) return null;

  // Webhook secret is also reused as the optional request-signing
  // secret. The provider issues both as a single pcs_… string in the
  // approval email; storing one slot keeps the admin UI lean.
  const webhookSecret = settings.printingComicsWebhookSecret
    ? getSecret("printingcomics_webhook_secret", settings.printingComicsWebhookSecret)
    : null;

  const environment: "production" | "sandbox" =
    settings.printingComicsEnvironment === "sandbox" ? "sandbox" : "production";

  return {
    apiKey,
    signingSecret: webhookSecret,
    webhookSecret,
    environment,
    // Provider has not published a separate sandbox host yet; both
    // environments hit the same base URL and are differentiated by
    // the key prefix (pc_test_ vs pc_live_) on their side.
    baseUrl: "https://printingcomics.com/api/v1",
  };
}
