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

    return { success: true, data: result };
  } catch (error) {
    paymentsDivinitycoinLogger.error({ err: error }, `[DivinityCoin API] ${action} error:`);
    return {
      success: false,
      error: error instanceof Error ? error.message : "DivinityCoin API call failed",
    };
  }
}
