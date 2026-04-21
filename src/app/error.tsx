"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
    // Don't report transient network/connectivity errors — they're user-side issues
    // and generate noise without being actionable (e.g. Firefox TypeError: network error).
    // Also drop ChunkLoadError — those fire when a user has an old bundle cached and we
    // ship a deploy that renames the chunk file. The reset button reloads the page and
    // everything recovers; nothing for us to debug.
    const msg = error?.message?.toLowerCase() ?? "";
    const isNetworkError =
      msg.includes("network error") ||
      msg.includes("failed to fetch") ||
      msg.includes("load failed") ||
      msg.includes("networkerror");
    const isChunkLoadError =
      error?.name === "ChunkLoadError" ||
      msg.includes("loading chunk") ||
      msg.includes("chunkloaderror");
    // Report to self-hosted error tracker
    if (error && !isNetworkError && !isChunkLoadError) {
      fetch("/api/error-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          metadata: { digest: error.digest, source: "page-error-boundary" },
        }),
      }).catch(() => {
        // Ignore fetch errors from the error reporter
      });
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="max-w-md text-center text-muted-foreground">
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
