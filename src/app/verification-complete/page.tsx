"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Validates and sanitizes return URL to prevent open redirect attacks.
 * Only allows relative paths starting with / (same-origin redirects).
 */
function getSafeReturnUrl(url: string | null): string {
  if (!url) return "/";

  // Check raw value first (browser already decodes once)
  const checkUrl = (value: string): boolean => {
    const lower = value.toLowerCase();
    return (
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !lower.startsWith("/\\") &&
      !lower.includes("javascript:") &&
      !lower.includes("data:") &&
      !lower.includes("vbscript:") &&
      // Prevent encoded variants that might bypass checks
      !lower.includes("%2f%2f") && // encoded //
      !lower.includes("%5c") // encoded \
    );
  };

  // Browser already decodes URL params, but check both raw and decoded for defense in depth
  if (!checkUrl(url)) return "/";

  try {
    // Also validate after additional decode to catch double-encoding attacks
    const decoded = decodeURIComponent(url);
    if (!checkUrl(decoded)) return "/";
    return url; // Return the original (already decoded by browser)
  } catch {
    // Invalid URL encoding - return original if it passed first check
    return url;
  }
}

function VerificationCompleteContent() {
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(3);
  const [isPopup, setIsPopup] = useState(false);

  // Sanitize returnUrl to prevent open redirect attacks
  const safeReturnUrl = useMemo(
    () => getSafeReturnUrl(searchParams.get("returnUrl")),
    [searchParams]
  );

  useEffect(() => {
    // Check if opened as a popup
    const hasOpener = !!window.opener;
    setIsPopup(hasOpener);

    if (hasOpener) {
      // Notify the parent window that verification is complete
      // Using window.location.origin for security instead of "*"
      try {
        window.opener.postMessage(
          { type: "verification-complete" },
          window.location.origin
        );
      } catch {
        // Ignore cross-origin errors
      }
      // Close the popup after a brief delay
      setTimeout(() => {
        window.close();
      }, 2000);
      return;
    }

    // If not a popup, countdown and redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = safeReturnUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [safeReturnUrl]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-[#05ce78]/10 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-[#05ce78]" />
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-2">Verification Complete</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for completing the identity verification process. Your account has been verified successfully.
          </p>

          {!isPopup && countdown > 0 && (
            <p className="text-sm text-muted-foreground">
              Redirecting you back in {countdown} second{countdown !== 1 ? "s" : ""}...
            </p>
          )}

          {isPopup && (
            <p className="text-sm text-muted-foreground">
              This window will close automatically...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2">Loading...</h1>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerificationCompletePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerificationCompleteContent />
    </Suspense>
  );
}
