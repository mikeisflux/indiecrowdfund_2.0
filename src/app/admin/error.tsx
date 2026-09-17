"use client";

import { useEffect, useState } from "react";
import { isStaleChunkError, recoverFromStaleChunk } from "@/lib/chunk-reload";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // A chunk that vanished under an open tab is a deploy artifact, not a
  // bug: reload onto the new build rather than showing an error page and
  // reporting noise. recoverFromStaleChunk refuses to loop, so a chunk
  // failure that is NOT stale still lands on the real error UI below.
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (isStaleChunkError(error) && recoverFromStaleChunk()) {
      setReloading(true);
    }
  }, [error]);

  useEffect(() => {
    if (isStaleChunkError(error)) return;
    console.error("Admin error:", error);
    // Report to self-hosted error tracker
    if (error) {
      fetch("/api/error-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          metadata: { digest: error.digest, source: "admin-error-boundary" },
        }),
      }).catch(() => {
        // Ignore fetch errors from the error reporter
      });
    }
  }, [error]);

  // Reload is in flight — show a neutral line rather than an alarming error
  // page for what is really just a new deploy landing.
  if (reloading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary motion-reduce:animate-none" />
        <p className="text-sm text-muted-foreground">Updating to the latest version…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold">Admin Panel Error</h2>
      <p className="max-w-md text-center text-muted-foreground">
        Something went wrong in the admin panel. Please try again.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
        <Button asChild variant="secondary">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>
    </div>
  );
}
