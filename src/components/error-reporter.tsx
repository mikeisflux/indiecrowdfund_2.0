"use client";

import { useEffect } from "react";

/**
 * Client-side error reporter that catches unhandled errors,
 * promise rejections, and HTTP error responses (4xx/5xx),
 * and sends them to /api/error-report.
 *
 * Mount once in the root layout.
 */
export function ErrorReporter() {
  useEffect(() => {
    const reportError = (message: string, stack?: string, metadata?: Record<string, unknown>) => {
      fetch("/api/error-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          stack,
          url: window.location.href,
          metadata: {
            source: "window-error-listener",
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            ...metadata,
          },
        }),
      }).catch(() => {
        // Silently fail — don't cause more errors
      });
    };

    const handleError = (event: ErrorEvent) => {
      // "Script error." is a generic cross-origin error with no useful info — skip it
      if (!event.message || event.message === "Script error." || event.message === "Script error") {
        return;
      }
      reportError(
        event.message || "Unhandled error",
        event.error?.stack
      );
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      reportError(`Unhandled Promise Rejection: ${message}`, stack);
    };

    // Intercept fetch to report HTTP 4xx/5xx errors to admin error logs
    const originalFetch = window.fetch;
    window.fetch = async function (...args: Parameters<typeof window.fetch>) {
      let response: Response;
      try {
        response = await originalFetch.apply(this, args);
      } catch (err) {
        // Network failures, AbortErrors, etc. — let them propagate naturally
        // but don't report them (the caller's catch handler should deal with these)
        throw err;
      }

      // Report 4xx/5xx errors (but skip the error-report endpoint itself to avoid loops)
      const input = args[0];
      const requestUrl =
        typeof input === "string" ? input
        : input instanceof URL ? input.href
        : input instanceof Request ? input.url
        // Fallback: duck-type check for Request-like objects (cross-realm instanceof can fail)
        : (typeof input === "object" && input !== null && "url" in input && typeof (input as Record<string, unknown>).url === "string")
          ? (input as Record<string, unknown>).url as string
        : "";
      // Skip: error-report endpoint (avoid loops), Next.js internal requests, empty/unresolvable URLs,
      // expected 400s from token-based flows (verify-email), 404s from surveys without a survey record,
      // and 401s from user-specific endpoints hit by unauthenticated visitors
      const isExpected400 = response.status === 400 && requestUrl.includes("/api/user/verify-email");
      const isExpected404 = response.status === 404 && requestUrl.includes("/api/surveys/") && requestUrl.includes("/respond");
      const isExpected401 = response.status === 401 && requestUrl.includes("/api/user/following");
      // collaborators/me never returns 403 itself — a 403 here means the bot blocker blocked the IP
      // digital-files/stream 403 = access denied for thumbnail (shows fallback icon, not a crash)
      // project stats 403 = bot blocker; stats endpoint has no 403 code path of its own
      const isExpected403 = response.status === 403 && (
        requestUrl.includes("/collaborators/me") ||
        requestUrl.includes("/api/backer/digital-files/stream") ||
        (requestUrl.includes("/api/projects/") && requestUrl.endsWith("/stats"))
      );
      const isInternal = !requestUrl || requestUrl.includes("/api/error-report") || requestUrl.includes("_next/") || requestUrl.includes("_rsc") || isExpected400 || isExpected404 || isExpected401 || isExpected403;
      if (response.status >= 400 && !isInternal) {
        reportError(
          `HTTP ${response.status} ${response.statusText}: ${requestUrl}`,
          undefined,
          {
            source: "fetch-error-interceptor",
            statusCode: response.status,
            requestUrl,
            referrer: document.referrer || undefined,
          }
        );
      }

      return response;
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
