"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  useEffect(() => {
    fetch("/api/error-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `404 Not Found: ${window.location.pathname}`,
        url: window.location.href,
        metadata: {
          source: "not-found-page",
          statusCode: 404,
          referrer: document.referrer || undefined,
        },
      }),
    }).catch(() => {
      // Silently fail
    });
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-4xl sm:text-6xl font-bold text-muted-foreground">404</h1>
      <h2 className="text-xl font-semibold">Page Not Found</h2>
      <p className="max-w-md text-center text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/discover">Explore projects</Link>
        </Button>
      </div>
    </div>
  );
}
