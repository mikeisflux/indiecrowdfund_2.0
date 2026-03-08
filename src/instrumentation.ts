/**
 * Next.js Instrumentation
 *
 * Suppresses known benign errors from polluting PM2 stderr logs:
 * - "Failed to find Server Action" from bot/scanner probes (handled by middleware)
 * - "The requested resource isn't a valid image" from video URLs hitting image optimizer
 * - "Input Buffer is empty" from Sharp processing empty/corrupt files
 * - "did not initialize yet" from Prisma client when running a stale build
 * - "Failed to parse body as FormData" from malformed external requests
 * - "account_invalid" from Stripe when a creator's connected account is deactivated
 */

export async function register() {
  // Initialize Sentry for error tracking (only when DSN is configured)
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("../sentry.server.config");
    }

    if (process.env.NEXT_RUNTIME === "edge") {
      await import("../sentry.edge.config");
    }
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
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

      originalConsoleError(...args);
    };
  }
}
