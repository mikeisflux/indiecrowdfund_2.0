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

    // Patterns that should NEVER reach PM2 stderr / Sentinel — they are
    // either bot probes (Next-Action header set to "x", "run", "hi", etc.)
    // or real clients running a stale build whose action IDs no longer
    // match the server. Both classes are operational noise, not bugs.
    const SUPPRESSED_STDERR_PATTERNS = [
      "Failed to find Server Action",
      "The requested resource isn't a valid image",
      "Input Buffer is empty",
      "did not initialize yet",
      "Failed to parse body as FormData",
      "account_invalid",
      "transformAlgorithm is not a function",
    ];

    // Some Next.js production code paths write directly to process.stderr
    // and bypass console.error. Wrap stderr.write so the same suppression
    // list applies regardless of which logger emitted the message.
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = function patchedWrite(
      this: NodeJS.WritableStream,
      ...args: unknown[]
    ): boolean {
      const chunk = args[0];
      const text =
        typeof chunk === "string"
          ? chunk
          : Buffer.isBuffer(chunk)
            ? chunk.toString("utf8")
            : chunk instanceof Uint8Array
              ? Buffer.from(chunk).toString("utf8")
              : "";
      if (text && SUPPRESSED_STDERR_PATTERNS.some((p) => text.includes(p))) {
        const cb = args.find((a) => typeof a === "function") as
          | ((err?: Error | null) => void)
          | undefined;
        cb?.();
        return true;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalStderrWrite as any)(...args);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

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

      // Suppress Node.js 22 undici TransformStream bug (benign internal error during fetch decompression)
      if (message.includes("transformAlgorithm is not a function")) {
        return;
      }

      // Suppress client disconnect errors (user navigated away or connection dropped mid-request)
      if (message === "aborted" || message.includes("aborted\n")) {
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
