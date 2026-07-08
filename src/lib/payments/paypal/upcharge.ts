import { getPayPalConfig, getPayPalAccessToken } from "./config";
import { logger } from "@/lib/logger";

const paypalUpchargeLogger = logger.child({ module: "paypal-upcharge" });

interface CreatePayPalUpchargeParams {
  pledgeId: string;
  projectId: string;
  amount: number;
  description?: string;
}

/**
 * Create a PayPal order (CAPTURE intent) for an upcharge on an
 * existing pledge. Does NOT create a new Pledge row -- the existing
 * /api/paypal/capture/[orderId] endpoint searches by
 * `paypalOrderId` on the Pledge model, so this orderId never lands
 * there and won't be mistaken for a new pledge. confirm-add-items
 * captures the order via the PayPal API directly.
 *
 * Always uses CAPTURE intent because the original pledge is already
 * COMPLETED -- the upcharge needs to charge immediately, not hold an
 * authorization for the campaign-funded flip.
 */
export async function createPayPalUpcharge({
  pledgeId,
  projectId,
  amount,
  description = "Pledge add-on items",
}: CreatePayPalUpchargeParams) {
  const config = await getPayPalConfig();
  const accessToken = await getPayPalAccessToken();
  const amountStr = amount.toFixed(2);

  const orderPayload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        // Prefix with `upcharge_` so the existing capture endpoint's
        // pledge lookup (which doesn't see this orderId on any Pledge
        // row) can't accidentally match if someone wires custom_id
        // into a future query. Pledge ID is preserved for log
        // correlation.
        custom_id: `upcharge_${pledgeId}`,
        description,
        amount: {
          currency_code: "USD",
          value: amountStr,
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          user_action: "PAY_NOW",
        },
      },
    },
  };

  const orderRes = await fetch(`${config.baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `upcharge_${pledgeId}_${Date.now()}`,
    },
    body: JSON.stringify(orderPayload),
  });

  if (!orderRes.ok) {
    const errBody = await orderRes.text();
    paypalUpchargeLogger.error(
      { pledgeId, err: errBody },
      "PayPal upcharge order creation failed"
    );
    throw new Error("Failed to create PayPal upcharge order");
  }

  const order = (await orderRes.json()) as { id: string };
  paypalUpchargeLogger.info(
    { pledgeId, projectId, paypalOrderId: order.id, amount },
    "PayPal upcharge order created"
  );

  return {
    paypalOrderId: order.id,
    paypalClientId: config.clientId,
    paypalMode: config.baseUrl.includes("sandbox") ? "sandbox" : "live",
  };
}

/**
 * Capture a PayPal upcharge order. Returns true if the order is now
 * (or already was) captured. Called from confirm-add-items after the
 * client reports that the user approved the order in PayPal's UI.
 *
 * Idempotent at the PayPal API level — re-capturing an already
 * captured order returns ORDER_ALREADY_CAPTURED which we treat as
 * success.
 */
export async function capturePayPalUpchargeOrder(
  orderId: string
): Promise<{ captured: boolean; alreadyCaptured?: boolean; captureId?: string }> {
  const config = await getPayPalConfig();
  const accessToken = await getPayPalAccessToken();

  // First check current state -- if already CAPTURED, skip the capture call.
  const detailRes = await fetch(`${config.baseUrl}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!detailRes.ok) {
    paypalUpchargeLogger.warn(
      { orderId, status: detailRes.status },
      "PayPal upcharge order fetch failed"
    );
    return { captured: false };
  }
  const detail = (await detailRes.json()) as {
    status: string;
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{ id: string; status: string }>;
      };
    }>;
  };
  if (detail.status === "COMPLETED") {
    const captureId = detail.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    return { captured: true, alreadyCaptured: true, captureId };
  }

  const captureRes = await fetch(
    `${config.baseUrl}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `capture_upcharge_${orderId}`,
      },
    }
  );
  if (!captureRes.ok) {
    const errBody = await captureRes.text();
    // PayPal returns 422 ORDER_ALREADY_CAPTURED if a parallel capture
    // beat us -- treat as success.
    if (errBody.includes("ORDER_ALREADY_CAPTURED")) {
      return { captured: true, alreadyCaptured: true };
    }
    paypalUpchargeLogger.error(
      { orderId, err: errBody },
      "PayPal upcharge capture failed"
    );
    return { captured: false };
  }
  const capture = (await captureRes.json()) as {
    status: string;
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{ id: string; status: string }>;
      };
    }>;
  };
  if (capture.status === "COMPLETED") {
    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    return { captured: true, captureId };
  }
  return { captured: false };
}
