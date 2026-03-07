/**
 * Request Correlation IDs
 * Generates and propagates correlation IDs across service boundaries.
 * Uses AsyncLocalStorage to make the ID available throughout the request lifecycle.
 */

import { AsyncLocalStorage } from "async_hooks";
import crypto from "crypto";

interface RequestContext {
  correlationId: string;
  startTime: number;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Generate a new correlation ID (compact UUID v4)
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Get the current correlation ID from the async context, or "unknown" if not set.
 */
export function getCorrelationId(): string {
  return asyncLocalStorage.getStore()?.correlationId || "unknown";
}

/**
 * Get the request start time for duration tracking
 */
export function getRequestStartTime(): number {
  return asyncLocalStorage.getStore()?.startTime || Date.now();
}

/**
 * Run a function within a correlation context.
 * Use this in API route handlers to establish a correlation ID for the request.
 *
 * @example
 *   import { withCorrelation } from "@/lib/correlation";
 *
 *   export async function POST(req: Request) {
 *     return withCorrelation(req, async (correlationId) => {
 *       logger.info({ correlationId }, "Processing request");
 *       // ... your handler logic
 *     });
 *   }
 */
export function withCorrelation<T>(
  req: Request,
  fn: (correlationId: string) => T | Promise<T>
): T | Promise<T> {
  const incomingId = req.headers.get("x-correlation-id") || req.headers.get("x-request-id");
  const correlationId = incomingId || generateCorrelationId();
  const context: RequestContext = { correlationId, startTime: Date.now() };

  return asyncLocalStorage.run(context, () => fn(correlationId));
}

export const CORRELATION_HEADER = "x-correlation-id";
