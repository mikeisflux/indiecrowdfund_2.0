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
      const requestUrl = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : args[0] instanceof URL ? args[0].href : "";
      // Skip: error-report endpoint (avoid loops), Next.js internal requests, and empty URLs
      const isInternal = requestUrl.includes("/api/error-report") || requestUrl.includes("_next/") || requestUrl.includes("_rsc") || requestUrl === "";
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
