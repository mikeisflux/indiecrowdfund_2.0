import { circuitBreaker, CircuitOpenError } from "@/lib/circuit-breaker";
import { SHIPSTATION_API_BASE } from "./shipstation-order";

// The ONE paced ShipStation V1 fetch. Push, tracking sync, credential checks
// and store listing all go through here so a push and the tracking cron in
// the same process share a single 40-requests-per-minute budget instead of
// each keeping their own clock and tripping 429s together.

const V1_MIN_GAP_MS = 1_600;
let lastCallAt = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export { CircuitOpenError };

/** Absolute URL for a V1 path (or pass a full URL through). */
export function shipStationUrl(pathOrUrl: string): string {
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${SHIPSTATION_API_BASE}${pathOrUrl}`;
}

export function getShipStationAuthHeader(apiKey: string, apiSecret: string): string {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

/**
 * Rate-limit-aware V1 call. Paces to stay inside 40/minute and, on a 429,
 * waits for the window named by X-Rate-Limit-Reset (V1 sends that rather
 * than Retry-After) before retrying — twice, then the 429 is returned so the
 * caller can stop and report what's left instead of failing the batch.
 */
export async function shipStationFetch(
  pathOrUrl: string,
  init: RequestInit,
  attempt = 0
): Promise<Response> {
  const since = Date.now() - lastCallAt;
  if (since < V1_MIN_GAP_MS) await sleep(V1_MIN_GAP_MS - since);
  lastCallAt = Date.now();

  const response = await circuitBreaker.execute("shipstation", () =>
    fetch(shipStationUrl(pathOrUrl), init)
  );

  if (response.status === 429 && attempt < 2) {
    const reset = Number(response.headers.get("X-Rate-Limit-Reset") || "0");
    await sleep(Math.min(Math.max(reset, 1) * 1000, 20_000));
    return shipStationFetch(pathOrUrl, init, attempt + 1);
  }
  return response;
}
