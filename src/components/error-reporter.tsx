"use client";

import { useEffect } from "react";

/**
 * Client-side error reporter that catches unhandled errors and
 * promise rejections and sends them to /api/error-report.
 *
 * Mount once in the root layout.
 */
export function ErrorReporter() {
  useEffect(() => {
    const reportError = (message: string, stack?: string) => {
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
          },
        }),
      }).catch(() => {
        // Silently fail — don't cause more errors
      });
    };

    const handleError = (event: ErrorEvent) => {
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

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
