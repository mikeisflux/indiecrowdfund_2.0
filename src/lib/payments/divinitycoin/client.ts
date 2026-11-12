import { circuitBreaker } from "@/lib/circuit-breaker";
import { getDivinityCoinConfig, paymentsDivinitycoinLogger } from "./config";

/**
 * DC's error text lives in different places depending on the action and
 * on which layer rejected the call: `error` as a string, `error.message`,
 * `message`, or Stripe's shape passed straight through. Find it.
 */
function dcErrorMessage(body: Record<string, unknown>): string | null {
  const candidates: unknown[] = [body.error, body.message, body.detail, body.reason];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (c && typeof c === "object") {
      const o = c as Record<string, unknown>;
      for (const k of ["message", "error", "detail", "code"]) {
        if (typeof o[k] === "string" && (o[k] as string).trim()) return (o[k] as string).trim();
      }
    }
  }
  return null;
}

/**
 * Call DivinityCoin Partner API
 * Used for making outbound API calls to DC (refund, release, capture, etc.)
 */
export async function callDivinityCoinAPI(
  action: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string; code?: string }> {
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

    const rawBody = await response.text();
    let result: Record<string, unknown> = {};
    try {
      const parsed = rawBody ? JSON.parse(rawBody) : {};
      if (parsed && typeof parsed === "object") result = parsed as Record<string, unknown>;
    } catch {
      // Non-JSON body (gateway error page, empty 502). Fall through with
      // the raw text as the message so the failure is at least readable.
    }

    if (!response.ok) {
      const message = dcErrorMessage(result) || rawBody.slice(0, 300) || `DC API ${action} failed with status ${response.status}`;
      // DC's refund endpoint spells its machine code `errorCode`
      // (ALREADY_PROCESSED, INSUFFICIENT_BALANCE…); the card endpoints use
      // `code`. Either one means DC made a decision; no code at all means
      // it fell over before deciding.
      const code =
        typeof result.code === "string" ? result.code : typeof result.errorCode === "string" ? result.errorCode : undefined;
      // The error text goes in the log MESSAGE, not just the attached
      // object: Sentinel showed "[DivinityCoin API] refund failed:" with
      // nothing after it, because DC's reason was in a body field the
      // logger didn't render.
      // idempotency_key_in_use means our earlier request is still being
      // processed; the caller reconciles. Warn so Sentinel doesn't page.
      const logDetail = { action, status: response.status, dcBody: rawBody.slice(0, 2000), payloadKeys: Object.keys(payload) };
      const logMessage = `[DivinityCoin API] ${action} failed (${response.status}): ${message}`;
      if (code === "idempotency_key_in_use") paymentsDivinitycoinLogger.warn(logDetail, logMessage);
      else paymentsDivinitycoinLogger.error(logDetail, logMessage);
      return { success: false, error: message, code };
    }

    // DC returns HTTP 200 with { success: false } for payload-level
    // failures (rejected refund, bad params). Treating any 200 as success
    // meant refund callers marked pledges REFUNDED on refunds DC actually
    // rejected — the backer never got their money and nothing retried.
    // Only an explicit false fails; absent means the action has no
    // success field and the 200 is the answer.
    if (result.success === false) {
      const message = dcErrorMessage(result) || `DC API ${action} reported failure`;
      paymentsDivinitycoinLogger.error(
        { action, dcBody: rawBody.slice(0, 2000), payloadKeys: Object.keys(payload) },
        `[DivinityCoin API] ${action} returned success:false: ${message}`
      );
      return { success: false, error: message };
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
