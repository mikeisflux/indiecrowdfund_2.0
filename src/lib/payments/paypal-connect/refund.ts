import { logger } from "@/lib/logger";
import { getPayPalConnectConfig, getPayPalConnectAccessToken } from "./config";

const refundLogger = logger.child({ module: "paypal-connect-refund" });

/**
 * Refunds a PayPal Connect capture. With delayed disbursement, refunds must be
 * issued before funds are disbursed to the creator; once disbursed, the
 * refund draws from the creator's balance.
 *
 * Pass `amount` for a partial refund; omit for a full refund.
 */
export async function refundPayPalConnectCapture(
  captureId: string,
  amount?: number,
): Promise<{ id: string; status: string }> {
  const config = await getPayPalConnectConfig();
  const accessToken = await getPayPalConnectAccessToken();

  const res = await fetch(`${config.baseUrl}/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Partner-Attribution-Id": config.bnCode,
    },
    body: JSON.stringify(
      amount != null ? { amount: { currency_code: "USD", value: amount.toFixed(2) } } : {},
    ),
  });

  if (!res.ok) {
    const errBody = await res.text();
    refundLogger.error({ captureId, err: errBody }, "PayPal Connect refund failed");
    throw new Error("Failed to refund PayPal Connect capture");
  }

  const data = (await res.json()) as { id: string; status: string };
  refundLogger.info({ captureId, refundId: data.id, status: data.status }, "PayPal Connect refund issued");
  return data;
}
