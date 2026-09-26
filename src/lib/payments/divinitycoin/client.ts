import { circuitBreaker } from "@/lib/circuit-breaker";
import { getDivinityCoinConfig, paymentsDivinitycoinLogger } from "./config";

/**
 * Call DivinityCoin Partner API
 * Used for making outbound API calls to DC (refund, release, capture, etc.)
 */
export async function callDivinityCoinAPI(
  action: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const config = await getDivinityCoinConfig();

    const response = await circuitBreaker.execute("divinitycoin", () =>
      fetch(`${config.baseUrl}?action=${action}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "X-Partner-ID": config.partnerId,
        },
        body: JSON.stringify(payload),
      })
    );

    const result = await response.json();

    if (!response.ok) {
      paymentsDivinitycoinLogger.error({ err: result }, `[DivinityCoin API] ${action} failed:`);
      return {
        success: false,
        error: result.error || `DC API ${action} failed with status ${response.status}`,
      };
    }

    // DC returns HTTP 200 with { success: false } for payload-level
    // failures (rejected refund, bad params). Treating any 200 as success
    // meant refund callers marked pledges REFUNDED on refunds DC actually
    // rejected — the backer never got their money and nothing retried.
    // Only an explicit false fails; absent means the action has no
    // success field and the 200 is the answer.
    if (result && typeof result === "object" && result.success === false) {
      paymentsDivinitycoinLogger.error(
        { err: result },
        `[DivinityCoin API] ${action} returned success:false in a 200 body`
      );
      return {
        success: false,
        error: result.error || `DC API ${action} reported failure`,
      };
    }

    return { success: true, data: result };
  } catch (error) {
    paymentsDivinitycoinLogger.error({ err: error }, `[DivinityCoin API] ${action} error:`);
    return {
      success: false,
      error: error instanceof Error ? error.message : "DivinityCoin API call failed",
    };
  }
}
