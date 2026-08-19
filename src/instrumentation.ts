/**
 * Next.js Instrumentation
 *
 * - Captures unhandled server errors to the self-hosted error tracker
 * - Quiets known log noise WITHOUT hiding anything that carries signal
 *
 * This list started as "suppress benign errors" and drifted into suppressing
 * things that were not benign at all. Two of them mattered:
 *
 *   account_invalid      A creator's connected payment account has been
 *                        deactivated, so their payouts are broken. Nothing
 *                        anywhere else in the codebase handles this code —
 *                        the only thing that ever touched it was this filter,
 *                        which threw it away. Nobody was told: not the
 *                        creator, not an admin.
 *   did not initialize   Prisma failed to start. Silencing it meant a
 *                        crash-looping deploy showed up as an empty log,
 *                        which is exactly how a rolled-back release went
 *                        undiagnosed.
 *
 * So there are now two tiers. DROP is for output that is genuinely somebody
 * else's problem and carries no information — bot probes, client disconnects,
 * a known Node bug. THROTTLED is for real signal that was merely noisy: it
 * still reaches the log and the error tracker, just at most once every few
 * minutes per pattern, with a line saying what it means.
 *
 * The bar for DROP: if this fired a thousand times, would anyone want to
 * know? If yes, it belongs in THROTTLED.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { captureError } = await import("@/lib/error-tracker");
    const originalConsoleError = console.error;

    // Tier 1 — dropped outright. No signal in any of these.
    //
    //   Failed to find Server Action  bot probes (Next-Action: "x", "run",
    //                                 "hi"), and real clients on a stale build
    //                                 after a deploy. Neither is actionable
    //                                 server-side.
    //   Failed to parse body as       malformed multipart from scanners.
    //     FormData
    //   aborted                       the reader navigated away mid-request.
    //   transformAlgorithm is not     a Node 22 undici bug in fetch
    //     a function                  decompression, not our code. Currently
    //                                 on v22.22.2; this goes away on upgrade
    //                                 and the entry can be deleted then.
    const DROP_PATTERNS = [
      "Failed to find Server Action",
      "Failed to parse body as FormData",
      "transformAlgorithm is not a function",
    ];

    // Tier 2 — real problems that were being hidden. Rate-limited so a storm
    // can't flood PM2, but never silenced.
    const THROTTLED_PATTERNS: { match: string; meaning: string }[] = [
      {
        match: "account_invalid",
        meaning:
          "a creator's connected payment account is deactivated — their payouts will fail until it is reconnected",
      },
      {
        match: "did not initialize yet",
        meaning:
          "Prisma client failed to initialize — if this is repeating, the deploy is broken, not slow",
      },
      {
        match: "Input Buffer is empty",
        meaning:
          "image processing received an empty buffer — an upload is corrupt or missing from storage",
      },
      {
        match: "The requested resource isn't a valid image",
        meaning:
          "next/image was pointed at something that is not an image — bad data in an image field",
      },
    ];

    const THROTTLE_MS = 5 * 60 * 1000;
    const lastEmitted = new Map<string, number>();

    /** null = drop, string = emit with this explanation, undefined = pass through. */
    function classify(text: string): { drop: boolean; note?: string } {
      if (DROP_PATTERNS.some((p) => text.includes(p))) return { drop: true };
      for (const { match, meaning } of THROTTLED_PATTERNS) {
        if (!text.includes(match)) continue;
        const now = Date.now();
        const previous = lastEmitted.get(match) ?? 0;
        if (now - previous < THROTTLE_MS) return { drop: true };
        lastEmitted.set(match, now);
        return { drop: false, note: `[surfaced: ${meaning}]` };
      }
      return { drop: false };
    }

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
      if (text) {
        const verdict = classify(text);
        if (verdict.drop) {
          const cb = args.find((a) => typeof a === "function") as
            | ((err?: Error | null) => void)
            | undefined;
          cb?.();
          return true;
        }
        if (verdict.note) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (originalStderrWrite as any)(`${verdict.note}\n`);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalStderrWrite as any)(...args);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    console.error = (...args: unknown[]) => {
      const message = args
        .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : String(a)))
        .join(" ");

      // Client disconnected mid-request. Nothing to act on and nothing to
      // learn from a second one.
      if (message === "aborted" || message.includes("aborted\n")) {
        return;
      }

      const verdict = classify(message);
      if (verdict.drop) return;
      if (verdict.note) {
        // Log the explanation alongside the original message, so whoever
        // reads it doesn't have to already know what the code means.
        // Throttled inside classify(), so this can't become the noise it
        // replaced. Self-contained and returns: falling through would record
        // the same event a second time via the generic capture below.
        originalConsoleError(verdict.note, ...args);
        captureError({
          error: message,
          source: "SERVER",
          level: "WARNING",
          metadata: { surfaced: true, note: verdict.note },
        }).catch(() => {});
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
