import Whop from "@whop/sdk";
import { getWhopConfig } from "./config";
import { logger } from "@/lib/logger";

const whopUpchargeLogger = logger.child({ module: "whop-upcharge" });

interface CreateWhopUpchargeParams {
  pledgeId: string;
  projectId: string;
  userId: string;
  amount: number;
  description?: string;
}

/**
 * Create a Whop checkout configuration for an upcharge on an existing
 * pledge. Does NOT create a new Pledge row — the upcharge belongs to
 * the existing pledge. The metadata.type="upcharge" lets the webhook
 * handler short-circuit out of the new-pledge-completion flow when
 * the payment_succeeded event fires.
 *
 * After the backer completes checkout, the client calls
 * /api/pledges/[id]/confirm-add-items which verifies the payment via
 * Whop's API and applies the addons to the existing pledge.
 */
export async function createWhopUpcharge({
  pledgeId,
  projectId,
  userId,
  amount,
  description = "Pledge add-on items",
}: CreateWhopUpchargeParams) {
  const config = await getWhopConfig();
  const client = new Whop({ apiKey: config.apiKey });

  const checkoutConfig = await client.checkoutConfigurations.create({
    plan: {
      company_id: config.companyId,
      currency: "usd",
      initial_price: amount,
      plan_type: "one_time",
      release_method: "buy_now",
    },
    metadata: {
      type: "upcharge",
      pledgeId,
      projectId,
      userId,
      description,
    },
  });

  whopUpchargeLogger.info(
    { pledgeId, checkoutId: checkoutConfig.id, amount },
    "Whop upcharge checkout configuration created"
  );

  return {
    sessionId: checkoutConfig.id,
    planId: config.planId,
    environment: config.environment,
  };
}

/**
 * Verify a Whop upcharge payment succeeded for a given checkout
 * configuration. Used by confirm-add-items after the client reports
 * the Whop SDK has completed. Returns true if at least one paid
 * payment exists for the checkout config.
 */
export async function verifyWhopUpchargePayment(
  checkoutConfigurationId: string
): Promise<{ paid: boolean; paymentId?: string }> {
  const config = await getWhopConfig();
  const client = new Whop({ apiKey: config.apiKey });

  // List payments scoped to our company; filter by checkout config in
  // application code (the list endpoint doesn't take a direct filter
  // for it, but the payments are scoped by company and we look at
  // metadata to match -- cheap enough since the upcharge happens
  // within minutes of init).
  try {
    const pageIter = await client.payments.list({
      company_id: config.companyId,
      first: 50,
    });
    for await (const p of pageIter) {
      const payment = p as unknown as {
        id?: string;
        status?: string;
        checkout_configuration_id?: string;
        metadata?: Record<string, string>;
      };
      if (
        payment.checkout_configuration_id === checkoutConfigurationId &&
        (payment.status === "paid" || payment.status === "succeeded")
      ) {
        return { paid: true, paymentId: payment.id };
      }
    }
    return { paid: false };
  } catch (err) {
    whopUpchargeLogger.error(
      { err: String(err), checkoutConfigurationId },
      "verifyWhopUpchargePayment failed"
    );
    return { paid: false };
  }
}
