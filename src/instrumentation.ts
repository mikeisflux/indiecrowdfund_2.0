/**
 * Next.js Instrumentation
 *
 * - Captures unhandled server errors to the self-hosted error tracker
 * - Suppresses known benign errors from polluting PM2 stderr logs:
 *   "Failed to find Server Action", "not a valid image", "Input Buffer is empty",
 *   "did not initialize yet", "Failed to parse body as FormData", "account_invalid"
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { captureError } = await import("@/lib/error-tracker");
    const originalConsoleError = console.error;

    console.error = (...args: unknown[]) => {
      const message = args
        .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : String(a)))
        .join(" ");

      // Suppress bot-triggered server action errors (already handled by middleware with 400/403)
      if (message.includes("Failed to find Server Action")) {
        return;
      }

      // Suppress image optimizer errors for non-image files (video URLs in image fields)
      if (message.includes("The requested resource isn't a valid image")) {
        return;
      }

      // Suppress Sharp empty buffer errors (corrupt or missing uploaded files)
      if (message.includes("Input Buffer is empty")) {
        return;
      }

      // Suppress Prisma client initialization errors (stale build running before rebuild)
      if (message.includes("did not initialize yet")) {
        return;
      }

      // Suppress malformed FormData from bad external requests (bots/scanners)
      if (message.includes("Failed to parse body as FormData")) {
        return;
      }

      // Suppress Stripe account_invalid errors (creator's connected account deactivated)
      if (message.includes("account_invalid")) {
        return;
      }

      // Capture non-suppressed errors to the error tracker (fire-and-forget)
      const errorObj = args.find((a) => a instanceof Error) as Error | undefined;
      if (errorObj) {
        captureError({
          error: errorObj,
          source: "SERVER",
          level: "ERROR",
          metadata: { rawMessage: message },
        }).catch(() => {});
      } else if (message.toLowerCase().includes("error") || message.toLowerCase().includes("fail")) {
        // Capture string-based error messages
        captureError({
          error: message,
          source: "SERVER",
          level: "WARNING",
          metadata: { rawArgs: args.map(String) },
        }).catch(() => {});
      }

      originalConsoleError(...args);
    };
  }
}
