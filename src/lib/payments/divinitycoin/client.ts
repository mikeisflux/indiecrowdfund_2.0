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
const GATEWAY_STATUSES = new Set([502, 503, 504]);
const READ_ONLY_ACTIONS = new Set(["lookup-payment", "verify-payment", "get-checkout-session", "get-setup-intent", "get-payment-method", "get-balance", "list-payments"]);

// One admin notice per quarter hour while DC's gateway is answering 5xx,
// so an outage is visible without each cron tick paging separately.
let lastOutageAlertAt = 0;
function noteGatewayOutage(action: string, status: number): void {
  const now = Date.now();
  if (now - lastOutageAlertAt < 15 * 60 * 1000) return;
  lastOutageAlertAt = now;
  void import("@/lib/admin-alerts")
    .then(({ alertAdmins }) =>
      alertAdmins({
        title: `DivinityCoin API unreachable (HTTP ${status})`,
        message: `DivinityCoin's gateway answered ${status} to "${action}". Payments, lookups and recoups will fail until it is back; the reconcile and recoup crons retry on their own. If this lasts more than a few minutes, check status with DivinityCoin.`,
        actionUrl: "/admin/error-logs",
        throttleKey: "dc-gateway-outage",
        throttleMinutes: 15,
      })
    )
    .catch(() => {});
}

export async function callDivinityCoinAPI(
  action: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string; code?: string }> {
  try {
    const config = await getDivinityCoinConfig();

    const send = () =>
      circuitBreaker.execute("divinitycoin", () =>
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

    let response = await send();
    // DC's nginx answers 502/503/504 for a moment during their deploys. A
    // read (lookup, verify, get-session) is safe to send again; one retry
    // after a short pause rides out most of those. Writes are not retried
    // here: their callers hold idempotency keys and decide.
    if (GATEWAY_STATUSES.has(response.status) && READ_ONLY_ACTIONS.has(action)) {
      await new Promise((r) => setTimeout(r, 1500));
      response = await send();
    }

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
      // A gateway page from DC's nginx means DC was unreachable, not that
      // the request was wrong. Say so in one line rather than dumping HTML.
      const gatewayOutage = GATEWAY_STATUSES.has(response.status) || /^\s*<(!doctype|html)/i.test(rawBody);
      const outageMessage = `DivinityCoin API unavailable (HTTP ${response.status} from its gateway)`;
      const finalMessage = gatewayOutage ? outageMessage : message;
      const finalCode = gatewayOutage ? "gateway_unavailable" : code;
      const logDetail = { action, status: response.status, dcBody: gatewayOutage ? undefined : rawBody.slice(0, 2000), payloadKeys: Object.keys(payload) };
      const logMessage = `[DivinityCoin API] ${action} failed (${response.status}): ${finalMessage}`;
      // Not server faults: DC briefly down (callers retry or the cron
      // picks it up next tick), a request already in flight, or a card
      // declined with a structured reason (the recoup/charge code records
      // and notifies). Everything else is an error.
      if (gatewayOutage || code === "idempotency_key_in_use" || code === "card_declined" || response.status === 402) {
        paymentsDivinitycoinLogger.warn(logDetail, logMessage);
      } else {
        paymentsDivinitycoinLogger.error(logDetail, logMessage);
      }
      if (gatewayOutage) noteGatewayOutage(action, response.status);
      return { success: false, error: finalMessage, code: finalCode };
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
