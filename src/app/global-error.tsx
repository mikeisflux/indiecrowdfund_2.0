"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Next.js 14 known bug: error can be null, causing "Cannot read properties of null (reading 'digest')"
  // This global error boundary prevents that crash from propagating
  const message = error?.message || "An unexpected error occurred";
  const digest = error?.digest;

  useEffect(() => {
    if (error) {
      // ChunkLoadError = stale JS chunks after a deploy (user has old cached page).
      // Auto-reload once to pick up the new chunks. Guard against reload loops with sessionStorage.
      const isChunkError =
        error.message?.includes("Loading chunk") ||
        error.message?.includes("ChunkLoadError") ||
        error.name === "ChunkLoadError";
      if (isChunkError) {
        const key = "chunk_reload_attempted";
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          window.location.reload();
          return;
        }
      }

      // Report to self-hosted error tracker
      fetch("/api/error-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          metadata: { digest: error.digest, source: "global-error-boundary" },
        }),
      }).catch(() => {
        // Ignore fetch errors from the error reporter
      });
    }
  }, [error]);

  // Log for debugging but don't crash
  if (error) {
    console.error("[GlobalError]", message, digest ? `(digest: ${digest})` : "");
  }

  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h2>Something went wrong</h2>
        <p style={{ color: "#666", marginBottom: "1rem" }}>{message}</p>
        <button
          onClick={() => reset()}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
