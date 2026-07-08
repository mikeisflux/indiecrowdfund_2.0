import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getPayPalConnectConfig, payPalConnectHeaders } from "./config";

const paypalConnectOnboardingLogger = logger.child({ module: "paypal-connect-onboarding" });

/**
 * Generates a PayPal Partner Referrals (v2) signup link for a creator so they
 * can connect their own PayPal account to the platform (the marketplace
 * equivalent of Stripe Connect's account onboarding link).
 *
 * We request the features needed to route payments to the creator and take a
 * platform fee: PAYMENT, REFUND, DELAY_FUNDS_DISBURSEMENT, PARTNER_FEE, and
 * ACCESS_MERCHANT_INFORMATION. `tracking_id` is our userId so the return URL
 * and webhooks correlate back to this creator.
 *
 * Returns the `action_url` the creator should be redirected to (single-use).
 */
export async function createPayPalConnectOnboardingLink(
  userId: string,
  returnUrl: string,
): Promise<string> {
  const config = await getPayPalConnectConfig();

  const res = await fetch(`${config.baseUrl}/v2/customer/partner-referrals`, {
    method: "POST",
    headers: await payPalConnectHeaders(),
    body: JSON.stringify({
      tracking_id: userId,
      partner_config_override: {
        return_url: returnUrl,
      },
      operations: [
        {
          operation: "API_INTEGRATION",
          api_integration_preference: {
            rest_api_integration: {
              integration_method: "PAYPAL",
              integration_type: "THIRD_PARTY",
              third_party_details: {
                features: [
                  "PAYMENT",
                  "REFUND",
                  "DELAY_FUNDS_DISBURSEMENT",
                  "PARTNER_FEE",
                  "ACCESS_MERCHANT_INFORMATION",
                ],
              },
            },
          },
        },
      ],
      products: ["EXPRESS_CHECKOUT"],
      legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    paypalConnectOnboardingLogger.error({ userId, err: errBody }, "Partner referral creation failed");
    throw new Error("Failed to create PayPal Connect onboarding link");
  }

  const data = (await res.json()) as { links?: Array<{ rel: string; href: string }> };
  const selfLink = data.links?.find((l) => l.rel === "self")?.href ?? null;
  const actionUrl = data.links?.find((l) => l.rel === "action_url")?.href ?? null;

  if (!actionUrl) {
    paypalConnectOnboardingLogger.error({ userId }, "Partner referral returned no action_url");
    throw new Error("PayPal Connect onboarding link missing");
  }

  // Record onboarding as started (idempotent upsert on userId).
  await db.payPalConnectAccount.upsert({
    where: { userId },
    create: {
      userId,
      trackingId: userId,
      referralSelfLink: selfLink,
      onboardingStatus: "STARTED",
      isLive: config.isLive,
    },
    update: {
      trackingId: userId,
      referralSelfLink: selfLink,
      onboardingStatus: "STARTED",
      isLive: config.isLive,
    },
  });

  paypalConnectOnboardingLogger.info({ userId }, "PayPal Connect onboarding link generated");
  return actionUrl;
}

interface SellerStatus {
  ready: boolean;
  paymentsReceivable: boolean;
  emailConfirmed: boolean;
  scopes: string[];
  raw: Record<string, unknown>;
}

/**
 * Reads a seller's onboarding status from PayPal
 * (GET /v1/customer/partners/{partnerId}/merchant-integrations/{sellerId}).
 * A creator is "ready" to accept pledges only when both payments_receivable
 * and primary_email_confirmed are true and they granted OAuth scopes.
 */
export async function getPayPalConnectSellerStatus(sellerMerchantId: string): Promise<SellerStatus> {
  const config = await getPayPalConnectConfig();

  const res = await fetch(
    `${config.baseUrl}/v1/customer/partners/${config.partnerMerchantId}/merchant-integrations/${sellerMerchantId}`,
    { headers: await payPalConnectHeaders() },
  );

  if (!res.ok) {
    const errBody = await res.text();
    paypalConnectOnboardingLogger.error({ sellerMerchantId, err: errBody }, "Seller status lookup failed");
    throw new Error("Failed to read PayPal Connect seller status");
  }

  const raw = (await res.json()) as Record<string, unknown>;
  const paymentsReceivable = raw.payments_receivable === true;
  const emailConfirmed = raw.primary_email_confirmed === true;

  const oauthIntegrations = Array.isArray(raw.oauth_integrations)
    ? (raw.oauth_integrations as Array<{ oauth_third_party?: Array<{ scopes?: string[] }> }>)
    : [];
  const scopes = oauthIntegrations
    .flatMap((i) => i.oauth_third_party ?? [])
    .flatMap((t) => t.scopes ?? []);

  return {
    ready: paymentsReceivable && emailConfirmed && scopes.length > 0,
    paymentsReceivable,
    emailConfirmed,
    scopes,
    raw,
  };
}

/**
 * Fetches the seller's live status from PayPal and syncs it onto the
 * PayPalConnectAccount row. Used by the return-URL handler, the status
 * endpoint, and the onboarding webhook. Returns whether the creator is ready.
 */
export async function syncPayPalConnectAccount(
  userId: string,
  sellerMerchantId: string,
): Promise<boolean> {
  const status = await getPayPalConnectSellerStatus(sellerMerchantId);

  await db.payPalConnectAccount.upsert({
    where: { userId },
    create: {
      userId,
      trackingId: userId,
      merchantIdInPayPal: sellerMerchantId,
      paymentsReceivable: status.paymentsReceivable,
      emailConfirmed: status.emailConfirmed,
      scopesGranted: status.scopes,
      onboardingStatus: status.ready ? "COMPLETED" : "PENDING",
    },
    update: {
      merchantIdInPayPal: sellerMerchantId,
      paymentsReceivable: status.paymentsReceivable,
      emailConfirmed: status.emailConfirmed,
      scopesGranted: status.scopes,
      onboardingStatus: status.ready ? "COMPLETED" : "PENDING",
    },
  });

  paypalConnectOnboardingLogger.info(
    { userId, sellerMerchantId, ready: status.ready },
    "PayPal Connect account synced",
  );
  return status.ready;
}
