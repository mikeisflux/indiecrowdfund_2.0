"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Link2 } from "lucide-react";

// Warns a creator who hasn't claimed a vanity URL that their project
// links won't resolve. The route file at /projects/[vanityname]/[slug]
// requires both segments — without a vanityUrl the project list page
// falls back to /projects/[slug], which Next.js parses as
// vanityname=slug + slug=undefined → 404. Rather than auto-generating a
// vanityUrl or accepting raw userIds in the URL (which we explicitly
// don't want for branding reasons), nudge the creator to pick their own.
//
// Render this above the dashboard header on creator-only pages. It
// fetches the user's current vanityUrl state on mount and renders
// nothing if they already have one.
export function VanityUrlWarningBanner() {
  const { status } = useSession();
  const [needsVanityUrl, setNeedsVanityUrl] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/user/me");
      if (!res.ok) return;
      const data = await res.json();
      if (data.user && !data.user.vanityUrl) {
        setNeedsVanityUrl(true);
      } else {
        setNeedsVanityUrl(false);
      }
    } catch {
      // Silently skip — banner is a nice-to-have, not load-bearing.
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      check();
    }
  }, [status, check]);

  if (!needsVanityUrl) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 px-4 py-3 relative z-40">
      <div className="container flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Set your custom URL.</strong>{" "}
            <span className="hidden sm:inline">
              Your project links won&apos;t work until you pick a custom URL for your profile.
            </span>
            <span className="sm:hidden">Project links need a custom URL.</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/dashboard/settings">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
            >
              <Link2 className="h-3 w-3 mr-1" />
              <span className="sm:hidden">Set</span>
              <span className="hidden sm:inline">Set Custom URL</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
