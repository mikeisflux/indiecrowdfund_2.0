import { db } from "@/lib/db";
import crypto from "crypto";

type ErrorLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "FATAL";
type ErrorSource = "CLIENT" | "SERVER" | "EDGE" | "API" | "MIDDLEWARE" | "CRON";

interface CaptureErrorOptions {
  error: Error | string;
  level?: ErrorLevel;
  source?: ErrorSource;
  endpoint?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  userAgent?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generate a fingerprint for error grouping.
 * Groups errors by their message + source + endpoint (like Sentry).
 */
function generateFingerprint(message: string, source: string, endpoint?: string): string {
  // Normalize the message: strip variable parts like IDs, timestamps, line numbers
  const normalized = message
    .replace(/\b[0-9a-f]{8,}\b/gi, "<id>") // hex IDs
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}\b/g, "<timestamp>") // timestamps
    .replace(/:\d+:\d+/g, ":<line>:<col>") // line:col in stack traces
    .replace(/\b\d+\b/g, "<n>") // numbers
    .slice(0, 200); // cap length

  const raw = `${source}:${endpoint || "unknown"}:${normalized}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/**
 * Extract a clean title from an error message (first line, truncated).
 */
function extractTitle(error: Error | string): string {
  const message = typeof error === "string" ? error : error.message;
  const firstLine = message.split("\n")[0].trim();
  return firstLine.length > 150 ? firstLine.slice(0, 147) + "..." : firstLine;
}

/**
 * Extract the error type name.
 */
function extractType(error: Error | string): string {
  if (typeof error === "string") return "Error";
  return error.constructor?.name || "Error";
}

// In-memory rate limiter to prevent DB flooding
const recentErrors = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 5000; // 5 seconds
const MAX_PER_FINGERPRINT = 3; // max 3 writes per fingerprint per window

function isRateLimited(fingerprint: string): boolean {
  const now = Date.now();
  const lastCount = recentErrors.get(fingerprint);

  // Clean up old entries periodically
  if (recentErrors.size > 1000) {
    recentErrors.clear();
  }

  if (!lastCount || lastCount < 0) {
    recentErrors.set(fingerprint, now);
    return false;
  }

  // Simple sliding window: track count in current window
  const key = `${fingerprint}:${Math.floor(now / RATE_LIMIT_WINDOW_MS)}`;
  const count = recentErrors.get(key) || 0;

  if (count >= MAX_PER_FINGERPRINT) {
    return true;
  }

  recentErrors.set(key, count + 1);
  return false;
}

/**
 * Capture an error and store it in the database.
 * Automatically deduplicates by fingerprint (like Sentry issue grouping).
 *
 * This is fire-and-forget — errors in the error tracker itself
 * are logged to console but never thrown.
 */
export async function captureError(options: CaptureErrorOptions): Promise<void> {
  try {
    const {
      error,
      level = "ERROR",
      source = "SERVER",
      endpoint,
      url,
      method,
      statusCode,
      userId,
      userAgent,
      ip,
      metadata,
    } = options;

    const message = typeof error === "string" ? error : error.message;
    const stack = typeof error === "string" ? undefined : error.stack;
    const type = extractType(error);
    const title = extractTitle(error);
    const fingerprint = generateFingerprint(message, source, endpoint);

    // Rate limit to prevent flooding
    if (isRateLimited(fingerprint)) {
      return;
    }

    const now = new Date();

    // Upsert the error group (create or increment count)
    await db.errorGroup.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        title,
        type,
        level,
        source,
        endpoint,
        status: "UNRESOLVED",
        eventCount: 1,
        firstSeen: now,
        lastSeen: now,
        latestMessage: message,
        latestStack: stack || null,
        latestMetadata: metadata || null,
        occurrences: {
          create: {
            message,
            stack: stack || null,
            url,
            method,
            statusCode,
            userId,
            userAgent,
            ip,
            metadata: metadata || null,
            timestamp: now,
          },
        },
      },
      update: {
        eventCount: { increment: 1 },
        lastSeen: now,
        latestMessage: message,
        latestStack: stack || null,
        latestMetadata: metadata || null,
        // Re-open resolved issues if they recur
        status: undefined, // Don't change status on update by default
        occurrences: {
          create: {
            message,
            stack: stack || null,
            url,
            method,
            statusCode,
            userId,
            userAgent,
            ip,
            metadata: metadata || null,
            timestamp: now,
          },
        },
      },
    });

    // Clean up old occurrences (keep max 50 per group) — fire and forget
    db.errorOccurrence
      .findMany({
        where: { group: { fingerprint } },
        orderBy: { timestamp: "desc" },
        skip: 50,
        select: { id: true },
      })
      .then((old: { id: string }[]) => {
        if (old.length > 0) {
          return db.errorOccurrence.deleteMany({
            where: { id: { in: old.map((o: { id: string }) => o.id) } },
          });
        }
      })
      .catch(() => {
        // Ignore cleanup errors
      });
  } catch (err) {
    // Never throw from the error tracker itself
    console.error("[ErrorTracker] Failed to capture error:", err);
  }
}

/**
 * Capture an error from the client side (sent via API).
 */
export async function captureClientError(
  message: string,
  stack: string | undefined,
  url: string,
  userAgent: string,
  userId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return captureError({
    error: Object.assign(new Error(message), { stack }),
    level: "ERROR",
    source: "CLIENT",
    url,
    userAgent,
    userId,
    metadata,
  });
}
