"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Mail, X, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";

export function EmailVerificationBanner() {
  const { status } = useSession();
  const pathname = usePathname();
  const [needsVerification, setNeedsVerification] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // Once we've confirmed the email is verified we stop re-checking —
  // verification never reverts within a session.
  const confirmedVerifiedRef = useRef(false);

  const checkVerification = useCallback(async () => {
    if (confirmedVerifiedRef.current) return;
    try {
      // no-store so a freshly-verified user never gets a cached
      // "unverified" response from the browser/CDN.
      const res = await fetch("/api/user/me", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.user) return;
      if (data.user.emailVerified) {
        // Verified — clear the banner and stop polling.
        confirmedVerifiedRef.current = true;
        setNeedsVerification(false);
      } else {
        setNeedsVerification(true);
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Re-check on auth change AND on every route change. The banner lives
  // in the root layout and never remounts, so without re-checking on
  // navigation a user who verifies (via the emailed link, then clicks
  // "Browse Crowdfunds") would keep seeing the stale warning.
  useEffect(() => {
    if (status === "authenticated") {
      checkVerification();
    }
  }, [status, pathname, checkVerification]);

  // Also re-check when the tab regains focus — covers verifying in a
  // separate tab and switching back to the original one.
  useEffect(() => {
    if (status !== "authenticated") return;
    const recheck = () => {
      if (document.visibilityState === "visible") checkVerification();
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [status, checkVerification]);

  const handleResend = async () => {
    setSending(true);
    try {
      const res = await apiFetch("/api/user/verify-email", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
      }
    } catch {
      // Silently fail
    } finally {
      setSending(false);
    }
  };

  // Don't show on auth pages or admin pages
  if (!needsVerification || dismissed) return null;
  if (pathname?.startsWith("/login") || pathname?.startsWith("/register") || pathname?.startsWith("/admin") || pathname?.startsWith("/verify-email")) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 px-4 py-3 relative z-40">
      <div className="container flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Email not verified.</strong>{" "}
            {sent
              ? "Verification email sent! Check your inbox."
              : "Please verify your email address to pledge on projects."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!sent && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
              onClick={handleResend}
              disabled={sending}
            >
              {sending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Mail className="h-3 w-3 mr-1" />
              )}
              {sending ? "Sending..." : (
                <>
                  <span className="sm:hidden">Resend</span>
                  <span className="hidden sm:inline">Resend Verification Email</span>
                </>
              )}
            </Button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 p-1"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
